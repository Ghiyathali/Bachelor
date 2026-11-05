using System.Net;
using System.Net.Http.Json;
using RestServer.Controllers;
using RestServer.Models;

namespace RestServer.Tests;

[Collection("API integration")]
public class ReturningParticipantsEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static IEnumerable<EventRegistration> SignUps(int count, RegistrationStatus status, bool? attendedBefore, string? city = null) =>
        Enumerable.Range(0, count).Select(_ => new EventRegistration { Status = status, AttendedBefore = attendedBefore, City = city });

    private static Event MakeEvent(EventType? type, string date, params IEnumerable<EventRegistration>[] signUps) => new()
    {
        Name = "Returning test", EventType = type,
        StartsAt = DateTimeOffset.Parse(date), EndsAt = DateTimeOffset.Parse(date).AddHours(2),
        Registrations = signUps.SelectMany(s => s).ToList(),
    };

    [Fact]
    public async Task Returning_CountsAcceptedAnswersOnly_AndHidesSmallTypes()
    {
        await using var db = factory.CreateDbContext();
        var typeX = new EventType { Name = "Returning X" };
        var typeY = new EventType { Name = "Returning Y" };
        db.Events.AddRange(
            // X: 3 yes, 2 no -> 60 %. Unanswered and Pending sign-ups must not count.
            MakeEvent(typeX, "2101-03-01T10:00:00Z",
                SignUps(3, RegistrationStatus.Accepted, true),
                SignUps(2, RegistrationStatus.Accepted, false),
                SignUps(2, RegistrationStatus.Accepted, null),
                SignUps(5, RegistrationStatus.Pending, true)),
            // Y: only 4 answers -> hidden.
            MakeEvent(typeY, "2101-04-01T10:00:00Z",
                SignUps(2, RegistrationStatus.Accepted, true),
                SignUps(2, RegistrationStatus.Accepted, false)),
            // No type: 5 yes -> 100 %, shown as "Uncategorised".
            MakeEvent(null, "2101-05-01T10:00:00Z",
                SignUps(5, RegistrationStatus.Accepted, true)));
        await db.SaveChangesAsync();

        using var client = await factory.CreateAdminClientAsync();
        var response = await client.GetFromJsonAsync<ReturningParticipantsResponse>(
            "/api/dashboard/returning?from=2101-01-01&to=2101-12-31");

        Assert.NotNull(response);
        Assert.Equal(14, response.Answered);          // 5 + 4 + 5
        Assert.Equal(71.4, response.ReturningPercent); // 10 of 14
        Assert.Equal(
            [
                new ReturningByEventType(typeX.Id, "Returning X", 60.0),
                new ReturningByEventType(typeY.Id, "Returning Y", null),
                new ReturningByEventType(null, "Uncategorised", 100.0),
            ],
            response.ByEventType);
    }

    [Fact]
    public async Task Returning_HidesTotal_WhenFewerThanFiveAnswered()
    {
        await using var db = factory.CreateDbContext();
        db.Events.Add(MakeEvent(null, "2102-03-01T10:00:00Z",
            SignUps(3, RegistrationStatus.Accepted, true),
            SignUps(1, RegistrationStatus.Accepted, false)));
        await db.SaveChangesAsync();

        using var client = await factory.CreateAdminClientAsync();
        var response = await client.GetFromJsonAsync<ReturningParticipantsResponse>(
            "/api/dashboard/returning?from=2102-01-01&to=2102-12-31");

        Assert.NotNull(response);
        Assert.Null(response.Answered);
        Assert.Null(response.ReturningPercent);
        Assert.All(response.ByEventType, t => Assert.Null(t.ReturningPercent));
    }

    [Fact]
    public async Task Returning_FollowsFilterBar()
    {
        await using var db = factory.CreateDbContext();
        db.Events.Add(MakeEvent(null, "2103-03-01T10:00:00Z",
            SignUps(5, RegistrationStatus.Accepted, true, "Aalborg"),
            SignUps(5, RegistrationStatus.Accepted, false, "Odense")));
        await db.SaveChangesAsync();

        using var client = await factory.CreateAdminClientAsync();
        var all = await client.GetFromJsonAsync<ReturningParticipantsResponse>(
            "/api/dashboard/returning?from=2103-01-01&to=2103-12-31");
        var aalborg = await client.GetFromJsonAsync<ReturningParticipantsResponse>(
            "/api/dashboard/returning?from=2103-01-01&to=2103-12-31&city=aalborg");

        Assert.Equal((10, 50.0), (all!.Answered, all.ReturningPercent));
        Assert.Equal((5, 100.0), (aalborg!.Answered, aalborg.ReturningPercent));
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/dashboard/returning?from=2103-12-31&to=2103-01-01")).StatusCode);
    }
}
