using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using RestServer.Auth;
using RestServer.Controllers;
using RestServer.Models;

namespace RestServer.Tests;

// Walk-ins: people who came without signing up, entered as one number per event.
// Each test makes its own event type and filters on it, so tests never see each other's data.
[Collection("API integration")]
public class WalkInsEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static string Unique(string name) => $"{name} {Guid.NewGuid():N}"[..40];

    private static Event MakeEvent(string date, int walkIns = 0, int accepted = 0, string? city = null) => new()
    {
        Name = Unique("Walk-in test"),
        StartsAt = DateTimeOffset.Parse(date),
        EndsAt = DateTimeOffset.Parse(date).AddHours(2),
        WalkIns = walkIns,
        Registrations = Enumerable.Range(0, accepted)
            .Select(_ => new EventRegistration { Status = RegistrationStatus.Accepted, City = city }).ToList(),
    };

    private async Task<EventType> CreateTypeWithEvents(params Event[] events)
    {
        await using var db = factory.CreateDbContext();
        var type = new EventType { Name = Unique("Walk-in type") };
        foreach (var e in events) e.EventType = type;
        db.Events.AddRange(events);
        await db.SaveChangesAsync();
        return type;
    }

    private async Task<HttpClient> ClientForRole(string role)
    {
        await using var db = factory.CreateDbContext();
        var name = "walkin" + Guid.NewGuid().ToString("N")[..12];
        db.Accounts.Add(new Account
        {
            Username = name,
            Email = name + "@test.example",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123", workFactor: 4),
            RoleId = (await db.Roles.SingleAsync(r => r.Name == role)).Id,
        });
        await db.SaveChangesAsync();
        return await factory.CreateLoggedInClientAsync(name, "Password123");
    }

    [Fact]
    public async Task EventManager_SetsWalkIns_AndTheyAreListed()
    {
        var past = MakeEvent("2025-05-10T15:00:00Z");
        await CreateTypeWithEvents(past);
        using var client = await ClientForRole(RoleNames.EventManager);

        var response = await client.PatchAsJsonAsync($"/api/events/{past.Id}/walk-ins", new { walkIns = 7 });
        var list = await client.GetFromJsonAsync<List<EventWalkIns>>("/api/events/walk-ins");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(7, list!.Single(e => e.EventId == past.Id).WalkIns);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(10_001)]
    public async Task ImpossibleNumbers_AreRejected(int walkIns)
    {
        var past = MakeEvent("2025-05-11T15:00:00Z", walkIns: 3);
        await CreateTypeWithEvents(past);
        using var client = await factory.CreateAdminClientAsync();

        var response = await client.PatchAsJsonAsync($"/api/events/{past.Id}/walk-ins", new { walkIns });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await using var db = factory.CreateDbContext();
        Assert.Equal(3, (await db.Events.SingleAsync(e => e.Id == past.Id)).WalkIns);   // unchanged
    }

    [Fact]
    public async Task FutureEvent_CannotGetWalkIns_AndUnknownEventIs404()
    {
        var future = MakeEvent("2099-01-01T15:00:00Z");
        await CreateTypeWithEvents(future);
        using var client = await factory.CreateAdminClientAsync();

        var tooEarly = await client.PatchAsJsonAsync($"/api/events/{future.Id}/walk-ins", new { walkIns = 5 });
        var unknown = await client.PatchAsJsonAsync("/api/events/2147483647/walk-ins", new { walkIns = 5 });

        Assert.Equal(HttpStatusCode.BadRequest, tooEarly.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
    }

    [Fact]
    public async Task Overview_CountsWalkInsAsParticipants_ButNotInTheAcceptanceRate()
    {
        var type = await CreateTypeWithEvents(MakeEvent("2025-06-01T15:00:00Z", walkIns: 5, accepted: 6));
        using var client = await factory.CreateAdminClientAsync();

        var overview = await client.GetFromJsonAsync<OverviewResponse>($"/api/dashboard/overview?eventTypeId={type.Id}");

        Assert.Equal(11, overview!.TotalParticipants);   // 6 accepted + 5 walk-ins
        Assert.Equal(5, overview.WalkIns);
        Assert.Equal(100.0, overview.AcceptanceRate);    // walk-ins never signed up, so the rate is 6 of 6
    }

    [Fact]
    public async Task Overview_HidesFewerThan5WalkIns_ButStillCountsThem()
    {
        var type = await CreateTypeWithEvents(MakeEvent("2025-06-02T15:00:00Z", walkIns: 3, accepted: 6));
        using var client = await factory.CreateAdminClientAsync();

        var overview = await client.GetFromJsonAsync<OverviewResponse>($"/api/dashboard/overview?eventTypeId={type.Id}");

        Assert.Equal(9, overview!.TotalParticipants);
        Assert.Null(overview.WalkIns);   // NFR-02: a group of 3 is not shown on its own
    }

    [Fact]
    public async Task CityFilter_LeavesWalkInsOut_BecauseTheyHaveNoCity()
    {
        var type = await CreateTypeWithEvents(MakeEvent("2025-06-03T15:00:00Z", walkIns: 8, accepted: 6, city: "Aarhus"));
        using var client = await factory.CreateAdminClientAsync();

        var overview = await client.GetFromJsonAsync<OverviewResponse>($"/api/dashboard/overview?eventTypeId={type.Id}&city=Aarhus");
        var attendance = await client.GetFromJsonAsync<AttendanceByEventResponse>($"/api/dashboard/attendance?eventTypeId={type.Id}&city=Aarhus");

        Assert.Equal(6, overview!.TotalParticipants);
        Assert.Null(overview.WalkIns);
        Assert.Null(attendance!.Events.Single().WalkInCount);
    }

    [Fact]
    public async Task Attendance_ShowsWalkInsPerEvent_AndHidesSmallNumbers()
    {
        var type = await CreateTypeWithEvents(
            MakeEvent("2025-07-01T15:00:00Z", walkIns: 6),
            MakeEvent("2025-07-02T15:00:00Z", walkIns: 2));
        using var client = await factory.CreateAdminClientAsync();

        var attendance = await client.GetFromJsonAsync<AttendanceByEventResponse>($"/api/dashboard/attendance?eventTypeId={type.Id}");

        Assert.Equal([6, null], attendance!.Events.Select(e => e.WalkInCount).ToArray());
    }

    [Fact]
    public async Task TrendsAndEventTypes_CountWalkIns()
    {
        // 3 accepted + 3 walk-ins: each part alone is under 5, together they are 6 participants.
        var type = await CreateTypeWithEvents(MakeEvent("2025-08-10T15:00:00Z", walkIns: 3, accepted: 3));
        using var client = await factory.CreateAdminClientAsync();

        var trends = await client.GetFromJsonAsync<TrendsResponse>(
            $"/api/dashboard/trends?eventTypeId={type.Id}&from=2025-08-01&to=2025-08-31");
        var types = await client.GetFromJsonAsync<EventTypeComparisonResponse>(
            $"/api/dashboard/event-types?eventTypeId={type.Id}");

        Assert.Equal(6, trends!.Periods.Single().Participants);
        Assert.Equal(6, types!.Types.Single().Participants);
    }

    [Fact]
    public async Task Estimate_UsesWalkIns_EvenForEventsWithoutSignUps()
    {
        var type = await CreateTypeWithEvents(
            MakeEvent("2025-01-10T15:00:00Z", walkIns: 10),
            MakeEvent("2025-02-10T15:00:00Z", walkIns: 10),
            MakeEvent("2025-03-10T15:00:00Z", walkIns: 10));
        using var client = await factory.CreateAdminClientAsync();

        var estimate = await client.GetFromJsonAsync<AttendanceEstimateResponse>(
            $"/api/dashboard/estimate?eventTypeId={type.Id}&date=2026-12-01");

        Assert.Equal(3, estimate!.BasedOnEvents);
        Assert.Equal(10, estimate.Average);
    }
}
