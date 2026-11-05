using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using RestServer.Controllers;
using RestServer.Models;

namespace RestServer.Tests;

// #69: the real PYN sync against the mock PYN database (pyn_mock.sql) in the test database.
// The expected numbers come from the mock data: 9 events (1 draft), 144 sign-ups (3 edge cases).
public class PynSyncEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private readonly HttpClient _anonymous = factory.CreateHttpsClient();
    private HttpClient _admin = null!;

    public async Task InitializeAsync() => _admin = await factory.CreateAdminClientAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    private async Task<PynSyncRunResponse> SyncNow()
    {
        var response = await _admin.PostAsync("/api/admin/pyn-sync", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<PynSyncRunResponse>())!;
    }

    // The steps depend on each other, so they are one test with numbered steps
    // (xUnit does not guarantee the order of separate tests).
    [Fact]
    public async Task Sync_CopiesTheMockData_IsRepeatable_AndKeepsOurSettings()
    {
        await factory.CreatePynMockAsync();

        // Azure keeps data between runs. Assert insert counts against the existing
        // mock records, rather than assuming an empty destination database.
        await using var baseline = factory.CreateDbContext();
        var eventIds = await baseline.Database.SqlQueryRaw<Guid>(
            "SELECT id AS \"Value\" FROM pyn_mock_analytics.events").ToArrayAsync();
        var registrationIds = await baseline.Database.SqlQueryRaw<long>(
            "SELECT id AS \"Value\" FROM pyn_mock_analytics.event_registrations WHERE id < 9000").ToArrayAsync();
        var existingEvents = await baseline.Events.CountAsync(e => e.ExternalId.HasValue && eventIds.Contains(e.ExternalId.Value));
        var existingRegistrations = await baseline.EventRegistrations.CountAsync(r => r.ExternalId.HasValue && registrationIds.Contains(r.ExternalId.Value));
        var topics = await baseline.Database.SqlQueryRaw<string>(
            "SELECT DISTINCT lower(trim(topic)) AS \"Value\" FROM pyn_mock_analytics.events WHERE topic IS NOT NULL").ToArrayAsync();
        var existingTopics = await baseline.EventTypes.Select(t => t.Name.ToLower()).ToArrayAsync();
        var missingTopics = topics.Except(existingTopics).Count();

        // 1. First run: insert missing mock records and update existing ones.
        var first = await SyncNow();
        Assert.True(first.Succeeded, first.Error);
        Assert.Equal(8, first.EventsRead);                    // the draft is not in the view
        Assert.Equal(8 - existingEvents, first.EventsInserted);
        Assert.Equal(0, first.EventsSkipped);
        Assert.Equal(missingTopics, first.EventTypesCreated);
        Assert.Equal(144, first.RegistrationsRead);
        Assert.Equal(141 - existingRegistrations, first.RegistrationsInserted);
        Assert.Equal(2, first.RegistrationsEventNotFound);    // "Raggeaton" typo + draft event
        Assert.Equal(1, first.RegistrationsEventAmbiguous);   // same title twice, no date
        Assert.Equal(0, first.RegistrationsUnknownStatus);

        // 2. Staff open feedback for a synced event in OUR app.
        await using (var db = factory.CreateDbContext())
        {
            var dramaLab = await db.Events.SingleAsync(eventItem => eventItem.ExternalId == Guid.Parse("00000000-0000-4000-8000-000000000004"));
            dramaLab.IsFeedbackOpen = true;
            await db.SaveChangesAsync();
        }

        // 3. Second run straight after: nothing new, nothing changed - no duplicates.
        var second = await SyncNow();
        Assert.True(second.Succeeded, second.Error);
        Assert.Equal(0, second.EventsInserted);
        Assert.Equal(0, second.EventsUpdated);
        Assert.Equal(0, second.EventTypesCreated);
        Assert.Equal(0, second.RegistrationsInserted);
        Assert.Equal(0, second.RegistrationsUpdated);

        // 4. A sign-up is accepted at PYN -> the next run updates exactly that one.
        await factory.ExecuteSqlAsync("UPDATE pyn_mock.event_registrations SET status = 'Accepted' WHERE id = 1003");
        var third = await SyncNow();
        Assert.Equal(0, third.RegistrationsInserted);
        Assert.Equal(1, third.RegistrationsUpdated);

        // 5. What ended up in OUR tables.
        await using var check = factory.CreateDbContext();
        Assert.Equal(141, await check.EventRegistrations.CountAsync(registration => registration.ExternalId.HasValue && registrationIds.Contains(registration.ExternalId.Value)));
        Assert.Equal(RegistrationStatus.Accepted,
            (await check.EventRegistrations.SingleAsync(registration => registration.ExternalId == 1003)).Status);
        Assert.False(await check.Events.AnyAsync(eventItem => eventItem.ExternalId == Guid.Parse("00000000-0000-4000-8000-000000000008")));   // draft
        Assert.True((await check.Events.SingleAsync(eventItem => eventItem.ExternalId == Guid.Parse("00000000-0000-4000-8000-000000000004"))).IsFeedbackOpen);
        Assert.Equal(1, await check.EventTypes.CountAsync(eventType => eventType.Name.ToLower() == "workshop"));
        Assert.True(await check.EventTypes.AnyAsync(eventType => eventType.Name == "Language café"));

        var cities = await check.EventRegistrations
            .Where(registration => registration.ExternalId.HasValue && registrationIds.Contains(registration.ExternalId.Value))
            .Select(registration => registration.City)
            .Distinct()
            .ToListAsync();
        Assert.Contains("Aarhus", cities);            // cleaned from "  aarhus"
        Assert.DoesNotContain("  aarhus", cities);
        Assert.DoesNotContain("horsens ", cities);

        // 6. Admins can see the last run.
        var last = await _admin.GetFromJsonAsync<PynSyncRunResponse>("/api/admin/pyn-sync/last");
        Assert.Equal(third.Id, last!.Id);
    }

    [Fact]
    public async Task SyncNow_WithoutToken_Returns401()
    {
        var response = await _anonymous.PostAsync("/api/admin/pyn-sync", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SyncNow_AsNonAdmin_Returns403()
    {
        var username = "user" + Guid.NewGuid().ToString("N")[..12];
        await _admin.PostAsJsonAsync("/api/auth/register",
            new { email = $"{username}@test.example", username, password = "CorrectHorse1" });
        var userClient = await factory.CreateLoggedInClientAsync(username, "CorrectHorse1");

        var response = await userClient.PostAsync("/api/admin/pyn-sync", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
