using System.Net;
using System.Net.Http.Json;
using RestServer.Controllers;
using RestServer.Dashboard;
using RestServer.Models;

namespace RestServer.Tests;

[Collection("API integration")]
public class PromotionChannelsEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static IEnumerable<EventRegistration> SignUps(int count, RegistrationStatus status, string? heardAbout, string? city = null) =>
        Enumerable.Range(0, count).Select(_ => new EventRegistration { Status = status, HeardAbout = heardAbout, City = city });

    private static Event MakeEvent(string date, params IEnumerable<EventRegistration>[] signUps) => new()
    {
        Name = "Channels test",
        StartsAt = DateTimeOffset.Parse(date), EndsAt = DateTimeOffset.Parse(date).AddHours(2),
        Registrations = signUps.SelectMany(s => s).ToList(),
    };

    [Fact]
    public async Task Channels_CountAcceptedAnswersOnly_AndMergeSmallOnesIntoOther()
    {
        await using var db = factory.CreateDbContext();
        db.Events.Add(MakeEvent("2104-03-01T10:00:00Z",
            SignUps(6, RegistrationStatus.Accepted, "Instagram"),
            SignUps(5, RegistrationStatus.Accepted, "Friend"),
            SignUps(2, RegistrationStatus.Accepted, "LinkedIn"),
            SignUps(2, RegistrationStatus.Accepted, "Poster"),
            SignUps(1, RegistrationStatus.Accepted, "Other"),
            SignUps(7, RegistrationStatus.Pending, "Facebook"),   // not accepted -> not counted
            SignUps(3, RegistrationStatus.Accepted, null)));      // no answer -> not counted
        await db.SaveChangesAsync();

        using var client = await factory.CreateAdminClientAsync();
        var response = await client.GetFromJsonAsync<PromotionChannelsResponse>(
            "/api/dashboard/channels?from=2104-01-01&to=2104-12-31");

        Assert.Equal(
            [new ChannelCount("Instagram", 6), new ChannelCount("Friend", 5), new ChannelCount("Other", 5)],
            response!.Channels);
    }

    [Fact]
    public async Task Channels_FollowFilterBar_AndHideSmallOther()
    {
        await using var db = factory.CreateDbContext();
        db.Events.Add(MakeEvent("2105-03-01T10:00:00Z",
            SignUps(5, RegistrationStatus.Accepted, "Instagram", "Aalborg"),
            SignUps(3, RegistrationStatus.Accepted, "LinkedIn", "Aalborg"),
            SignUps(5, RegistrationStatus.Accepted, "Facebook", "Odense")));
        await db.SaveChangesAsync();

        using var client = await factory.CreateAdminClientAsync();
        var all = await client.GetFromJsonAsync<PromotionChannelsResponse>(
            "/api/dashboard/channels?from=2105-01-01&to=2105-12-31");
        var aalborg = await client.GetFromJsonAsync<PromotionChannelsResponse>(
            "/api/dashboard/channels?from=2105-01-01&to=2105-12-31&city=aalborg");

        Assert.Equal(
            [new ChannelCount("Facebook", 5), new ChannelCount("Instagram", 5), new ChannelCount("Other", null)],
            all!.Channels);
        Assert.Equal([new ChannelCount("Instagram", 5), new ChannelCount("Other", null)], aalborg!.Channels);
    }

    [Fact]
    public async Task Channels_EmptyWhenNoData_AndRejectBadDates()
    {
        using var client = await factory.CreateAdminClientAsync();
        var empty = await client.GetFromJsonAsync<PromotionChannelsResponse>(
            "/api/dashboard/channels?from=2106-01-01&to=2106-12-31");

        Assert.Empty(empty!.Channels);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/dashboard/channels?from=2106-12-31&to=2106-01-01")).StatusCode);
    }
}
