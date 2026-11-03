using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using RestServer.Controllers;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Tests;

// #25: the dashboard filter bar (FR-05) and the "fewer than 5 people" rule (NFR-02).
// Every test creates its own event type and filters on it, so tests never see each other's data.
[Collection("API integration")]
public class DashboardFilterTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static string Unique(string name) => $"{name} {Guid.NewGuid():N}"[..40];

    private static EventRegistration SignUp(RegistrationStatus status, string? city = null, string? gender = null) =>
        new() { Status = status, City = city, Gender = gender };

    private async Task<EventType> CreateTypeWithEvents(params Event[] events)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var type = new EventType { Name = Unique("Filter test") };
        foreach (var e in events)
            e.EventType = type;
        db.Events.AddRange(events);
        await db.SaveChangesAsync();
        return type;
    }

    private static Event MakeEvent(string date, int[] ratings, params EventRegistration[] signUps) => new()
    {
        Name = "Filter test event",
        StartsAt = DateTimeOffset.Parse(date),
        EndsAt = DateTimeOffset.Parse(date).AddHours(2),
        Feedback = ratings.Select(r => new Feedback { Rating = r }).ToList(),
        Registrations = signUps.ToList(),
    };

    private static EventRegistration[] Many(int count, RegistrationStatus status, string? city = null, string? gender = null) =>
        Enumerable.Range(0, count).Select(_ => SignUp(status, city, gender)).ToArray();

    [Fact]
    public async Task Overview_FilteredByEventType_CountsOnlyThatType()
    {
        var type = await CreateTypeWithEvents(MakeEvent("2035-03-10T15:00:00Z", [5, 4, 4, 3, 4, 5],
            [.. Many(6, RegistrationStatus.Accepted), .. Many(2, RegistrationStatus.Pending)]));
        using var client = await factory.CreateAdminClientAsync();

        var overview = await client.GetFromJsonAsync<OverviewResponse>($"/api/dashboard/overview?eventTypeId={type.Id}");

        Assert.Equal(new OverviewResponse(1, 6, 4.2, 6, 75.0), overview);
    }

    [Fact]
    public async Task Overview_FewerThan5People_IsHidden()
    {
        var type = await CreateTypeWithEvents(MakeEvent("2035-03-11T15:00:00Z", [5, 4, 3],
            Many(3, RegistrationStatus.Accepted)));
        using var client = await factory.CreateAdminClientAsync();

        var overview = await client.GetFromJsonAsync<OverviewResponse>($"/api/dashboard/overview?eventTypeId={type.Id}");

        // The event itself is not about people, so it is still counted.
        Assert.Equal(new OverviewResponse(1, null, null, null, null), overview);
    }

    [Fact]
    public async Task Overview_CityFilter_AppliesToSignUpsButNotToFeedback()
    {
        var type = await CreateTypeWithEvents(MakeEvent("2035-03-12T15:00:00Z", [4, 4, 4, 4, 4, 4],
            [.. Many(6, RegistrationStatus.Accepted, city: "Aarhus"), .. Many(5, RegistrationStatus.Accepted, city: "Vejle")]));
        using var client = await factory.CreateAdminClientAsync();

        var overview = await client.GetFromJsonAsync<OverviewResponse>($"/api/dashboard/overview?eventTypeId={type.Id}&city=vejle");

        Assert.Equal(5, overview!.TotalParticipants);   // only the Vejle sign-ups
        Assert.Equal(6, overview.FeedbackResponses);    // feedback has no city, so it is not filtered
    }

    [Fact]
    public async Task Satisfaction_RatingWithFewerThan5Responses_IsHidden()
    {
        var type = await CreateTypeWithEvents(MakeEvent("2035-03-13T15:00:00Z", [4, 4, 4, 4, 4, 5, 5]));
        using var client = await factory.CreateAdminClientAsync();

        var result = await client.GetFromJsonAsync<SatisfactionDistributionResponse>($"/api/dashboard/satisfaction?eventTypeId={type.Id}");

        Assert.Equal(7, result!.TotalResponses);
        Assert.Equal(5, result.Ratings.Single(r => r.Rating == 4).Count);
        Assert.Null(result.Ratings.Single(r => r.Rating == 5).Count);   // only 2 people gave a 5
    }

    [Fact]
    public async Task Attendance_GenderFilter_HidesGroupsOfFewerThan5()
    {
        var type = await CreateTypeWithEvents(MakeEvent("2035-03-14T15:00:00Z", [],
            [.. Many(6, RegistrationStatus.Accepted, gender: "Female"), .. Many(2, RegistrationStatus.Accepted, gender: "Male")]));
        using var client = await factory.CreateAdminClientAsync();

        var female = await client.GetFromJsonAsync<AttendanceByEventResponse>($"/api/dashboard/attendance?eventTypeId={type.Id}&gender=Female");
        var male = await client.GetFromJsonAsync<AttendanceByEventResponse>($"/api/dashboard/attendance?eventTypeId={type.Id}&gender=Male");

        Assert.Equal(6, female!.Events.Single().SignedUpCount);
        Assert.Null(male!.Events.Single().SignedUpCount);
    }

    [Fact]
    public async Task SeasonFilter_UsesTheEventDate()
    {
        var type = await CreateTypeWithEvents(
            MakeEvent("2035-01-15T15:00:00Z", []),
            MakeEvent("2035-07-15T15:00:00Z", []));
        using var client = await factory.CreateAdminClientAsync();

        async Task<int> EventsIn(string season) =>
            (await client.GetFromJsonAsync<OverviewResponse>($"/api/dashboard/overview?eventTypeId={type.Id}&season={season}"))!.TotalEvents;

        Assert.Equal(1, await EventsIn("Winter"));
        Assert.Equal(1, await EventsIn("Summer"));
        Assert.Equal(0, await EventsIn("Spring"));
    }

    [Fact]
    public async Task FilterOptions_OnlyOfferCitiesWithAtLeast5SignUps()
    {
        var big = Unique("Bigtown");
        var small = Unique("Smalltown");
        await CreateTypeWithEvents(MakeEvent("2035-03-15T15:00:00Z", [],
            [.. Many(5, RegistrationStatus.Accepted, city: big), .. Many(2, RegistrationStatus.Accepted, city: small)]));
        using var client = await factory.CreateAdminClientAsync();

        var options = await client.GetFromJsonAsync<FilterOptionsResponse>("/api/dashboard/filter-options");

        Assert.Contains(big, options!.Cities);
        Assert.DoesNotContain(small, options.Cities);
        Assert.Equal(["Winter", "Spring", "Summer", "Autumn"], options.Seasons);
    }

    [Fact]
    public async Task Trends_FollowTheFilterBar_AndHideSmallPeriods()
    {
        var type = await CreateTypeWithEvents(
            MakeEvent("2035-09-10T15:00:00Z", [4, 4, 4, 4, 4], Many(6, RegistrationStatus.Accepted)),
            MakeEvent("2035-10-10T15:00:00Z", [5, 5], Many(2, RegistrationStatus.Accepted)));
        using var client = await factory.CreateAdminClientAsync();

        var trends = await client.GetFromJsonAsync<TrendsResponse>(
            $"/api/dashboard/trends?eventTypeId={type.Id}&from=2035-09-01&to=2035-10-31");

        Assert.Equal(new TrendPoint(new DateOnly(2035, 9, 1), 1, 5, 4, 6), trends!.Periods[0]);
        Assert.Equal(new TrendPoint(new DateOnly(2035, 10, 1), 1, null, null, null), trends.Periods[1]);
    }

    [Fact]
    public async Task Overview_FromAfterTo_Returns400()
    {
        using var client = await factory.CreateAdminClientAsync();

        var response = await client.GetAsync("/api/dashboard/overview?from=2035-06-01&to=2035-01-01");

        Assert.Equal(System.Net.HttpStatusCode.BadRequest, response.StatusCode);
    }
}
