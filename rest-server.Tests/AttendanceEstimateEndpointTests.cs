using System.Net;
using System.Net.Http.Json;
using RestServer.Controllers;
using RestServer.Models;

namespace RestServer.Tests;

[Collection("API integration")]
public class AttendanceEstimateEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly DateTimeOffset Start = new(2010, 1, 1, 10, 0, 0, TimeSpan.Zero);

    private static Event MakeEvent(EventType type, DateTimeOffset startsAt, int accepted, int pending = 2) => new()
    {
        Name = "Estimate test", EventType = type,
        StartsAt = startsAt, EndsAt = startsAt.AddHours(2),
        Registrations = Enumerable.Range(0, accepted).Select(_ => new EventRegistration { Status = RegistrationStatus.Accepted })
            .Concat(Enumerable.Range(0, pending).Select(_ => new EventRegistration { Status = RegistrationStatus.Pending }))
            .ToList(),
    };

    [Fact]
    public async Task Estimate_UsesPastEventsWithSignUps_OfTheChosenType()
    {
        await using var db = factory.CreateDbContext();
        var type = new EventType { Name = "Estimate workshop" };
        var otherType = new EventType { Name = "Estimate other" };
        db.Events.AddRange(
            MakeEvent(type, Start, 10),
            MakeEvent(type, Start.AddDays(30), 22),
            MakeEvent(type, Start.AddDays(60), 28),
            MakeEvent(type, Start.AddDays(90), 40),
            MakeEvent(type, Start.AddDays(45), 0, pending: 0),          // no sign-ups -> no data, ignored
            MakeEvent(type, new DateTimeOffset(2099, 1, 1, 0, 0, 0, TimeSpan.Zero), 100), // not happened yet
            MakeEvent(otherType, Start.AddDays(10), 500));              // other type
        await db.SaveChangesAsync();

        using var client = await factory.CreateAdminClientAsync();
        var response = await client.GetFromJsonAsync<AttendanceEstimateResponse>(
            $"/api/dashboard/estimate?eventTypeId={type.Id}&date=2010-05-01");   // day 120

        Assert.Equal(
            new AttendanceEstimateResponse(type.Id, "Estimate workshop", new DateOnly(2010, 5, 1), 4, 25, 49, 47, 51),
            response);
    }

    [Fact]
    public async Task Estimate_NeedsThreePastEvents()
    {
        await using var db = factory.CreateDbContext();
        var type = new EventType { Name = "Estimate new type" };
        db.Events.AddRange(MakeEvent(type, Start, 10), MakeEvent(type, Start.AddDays(30), 20));
        await db.SaveChangesAsync();

        using var client = await factory.CreateAdminClientAsync();
        var response = await client.GetFromJsonAsync<AttendanceEstimateResponse>(
            $"/api/dashboard/estimate?eventTypeId={type.Id}&date=2030-01-01");

        Assert.Equal(2, response!.BasedOnEvents);
        Assert.Null(response.Average);
        Assert.Null(response.Estimate);
        Assert.Null(response.Low);
        Assert.Null(response.High);
    }

    [Fact]
    public async Task Estimate_RejectsMissingInput_AndUnknownType()
    {
        using var client = await factory.CreateAdminClientAsync();

        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/dashboard/estimate")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/dashboard/estimate?eventTypeId=1")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/dashboard/estimate?eventTypeId=2147483647&date=2030-01-01")).StatusCode);
    }
}
