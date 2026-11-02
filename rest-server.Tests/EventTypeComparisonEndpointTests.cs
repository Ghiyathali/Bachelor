using System.Net;
using System.Net.Http.Json;
using RestServer.Controllers;
using RestServer.Models;

namespace RestServer.Tests;

[Collection("API integration")]
public class EventTypeComparisonEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Comparison_WeightsResponses_CountsAccepted_AndSuppressesEachMeasure()
    {
        await using var db = factory.CreateDbContext();
        var workshop = new EventType { Name = "Comparison workshop" };
        var smallFeedback = new EventType { Name = "Comparison small feedback" };
        var smallParticipants = new EventType { Name = "Comparison small participants" };
        var unused = new EventType { Name = "Comparison unused" };
        Event MakeEvent(EventType? type, string date, int[] ratings, int accepted) => new()
        {
            Name = "Type comparison", EventType = type,
            StartsAt = DateTimeOffset.Parse(date), EndsAt = DateTimeOffset.Parse(date).AddHours(2),
            Feedback = ratings.Select(r => new Feedback { Rating = r }).ToList(),
            Registrations = Enumerable.Range(0, accepted).Select(_ => new EventRegistration { Status = RegistrationStatus.Accepted })
                .Concat(new[] { RegistrationStatus.Pending, RegistrationStatus.Waiting, RegistrationStatus.Rejected }
                    .Select(status => new EventRegistration { Status = status })).ToList(),
        };
        db.EventTypes.Add(unused);
        db.Events.AddRange(
            MakeEvent(workshop, "2037-01-01T00:00:00Z", [5, 5, 5, 5], 2),
            MakeEvent(workshop, "2037-01-31T23:59:59Z", [1], 3),
            MakeEvent(workshop, "2037-02-01T00:00:00Z", [1, 1, 1, 1, 1], 20),
            MakeEvent(smallFeedback, "2037-01-02T00:00:00Z", [2, 2, 2, 2], 5),
            MakeEvent(smallParticipants, "2037-01-02T00:00:00Z", [3, 3, 3, 3, 3], 4),
            MakeEvent(null, "2037-01-03T00:00:00Z", [], 0));
        await db.SaveChangesAsync();

        using var client = await factory.CreateAdminClientAsync();
        const string url = "/api/dashboard/event-types?from=2037-01-01&to=2037-01-31";
        var response = await client.GetFromJsonAsync<EventTypeComparisonResponse>(url);
        Assert.NotNull(response);
        Assert.Equal(4, response.Types.Count);
        Assert.Equal(new EventTypeComparison(workshop.Id, workshop.Name, 2, 4.2, 5),
            response.Types.Single(t => t.EventTypeId == workshop.Id));
        Assert.Equal(new EventTypeComparison(smallFeedback.Id, smallFeedback.Name, 1, null, 5),
            response.Types.Single(t => t.EventTypeId == smallFeedback.Id));
        Assert.Equal(new EventTypeComparison(smallParticipants.Id, smallParticipants.Name, 1, 3, null),
            response.Types.Single(t => t.EventTypeId == smallParticipants.Id));
        Assert.Equal(new EventTypeComparison(null, "Uncategorised", 1, null, null),
            response.Types.Single(t => t.EventTypeId == null));
        Assert.DoesNotContain(response.Types, t => t.EventTypeId == unused.Id);

        // No supporting count may disclose the suppressed feedback denominator.
        var json = await client.GetStringAsync(url);
        Assert.DoesNotContain("feedbackResponses", json, StringComparison.OrdinalIgnoreCase);

        var all = await client.GetFromJsonAsync<EventTypeComparisonResponse>("/api/dashboard/event-types");
        Assert.Equal(new EventTypeComparison(workshop.Id, workshop.Name, 3, 2.6, 25),
            all!.Types.Single(t => t.EventTypeId == workshop.Id));
        var empty = await client.GetFromJsonAsync<EventTypeComparisonResponse>(
            "/api/dashboard/event-types?from=2041-01-01&to=2041-01-31");
        Assert.Empty(empty!.Types);
    }

    [Theory]
    [InlineData("from=2037-02-01&to=2037-01-01")]
    [InlineData("from=invalid")]
    [InlineData("from=0001-01-01")]
    [InlineData("to=9999-12-31")]
    public async Task Comparison_RejectsInvalidDates(string query)
    {
        using var client = await factory.CreateAdminClientAsync();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/dashboard/event-types?{query}")).StatusCode);
    }

    [Fact]
    public async Task Comparison_RequiresAuthentication()
    {
        using var client = factory.CreateHttpsClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/dashboard/event-types")).StatusCode);
    }
}
