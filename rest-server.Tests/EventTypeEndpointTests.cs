using System.Net;
using System.Net.Http.Json;
using RestServer.Data;

namespace RestServer.Tests;

// #53: event types - the list, who may change it, and setting a type on an event.
public class EventTypeEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private readonly HttpClient _anonymous = factory.CreateHttpsClient();
    private HttpClient _admin = null!;

    public async Task InitializeAsync() => _admin = await factory.CreateAdminClientAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    private record EventTypeResult(int Id, string Name);
    private record EventResult(int Id, string Name, int? EventTypeId, string? EventTypeName);

    // Unique per test, so the tests never collide in the shared test database.
    private static string Unique(string prefix) => $"{prefix} {Guid.NewGuid().ToString("N")[..8]}";

    private async Task<EventTypeResult> CreateType(string name)
    {
        var response = await _admin.PostAsJsonAsync("/api/event-types", new { name });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<EventTypeResult>())!;
    }

    private Task<HttpResponseMessage> CreateEvent(int? eventTypeId)
    {
        var startsAt = DateTimeOffset.UtcNow.AddDays(7);
        return _admin.PostAsJsonAsync("/api/events", new
        {
            name = Unique("Test event"),
            startsAt,
            endsAt = startsAt.AddHours(2),
            eventTypeId,
        });
    }

    // ---------- LIST ----------

    [Fact]
    public async Task GetEventTypes_ContainsThePlaceholders()
    {
        var types = await _admin.GetFromJsonAsync<List<EventTypeResult>>("/api/event-types");

        var names = types!.Select(type => type.Name).ToList();
        foreach (var placeholder in EventTypeSeeder.PlaceholderTypes)
            Assert.Contains(placeholder, names);
    }

    [Fact]
    public async Task GetEventTypes_WithoutToken_Returns401()
    {
        var response = await _anonymous.GetAsync("/api/event-types");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ---------- ADD / RENAME / DELETE ----------

    [Fact]
    public async Task CreateEventType_AsAdmin_Returns201()
    {
        var name = Unique("Language cafe");

        var created = await CreateType(name);

        Assert.Equal(name, created.Name);
    }

    [Fact]
    public async Task CreateEventType_WithDuplicateName_Returns409()
    {
        var name = Unique("Hiking");
        await CreateType(name);

        // Same name in different letter case still counts as a duplicate.
        var response = await _admin.PostAsJsonAsync("/api/event-types", new { name = name.ToUpperInvariant() });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task CreateEventType_AsUser_Returns403()
    {
        var username = "user" + Guid.NewGuid().ToString("N")[..12];
        await _admin.PostAsJsonAsync("/api/auth/register",
            new { email = $"{username}@test.example", username, password = "CorrectHorse1" });
        var userClient = await factory.CreateLoggedInClientAsync(username, "CorrectHorse1");

        var response = await userClient.PostAsJsonAsync("/api/event-types", new { name = Unique("Not allowed") });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task RenameEventType_Returns200WithNewName()
    {
        var created = await CreateType(Unique("Placeholder"));
        var newName = Unique("Real name");

        var response = await _admin.PutAsJsonAsync($"/api/event-types/{created.Id}", new { name = newName });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var renamed = await response.Content.ReadFromJsonAsync<EventTypeResult>();
        Assert.Equal(newName, renamed!.Name);
    }

    [Fact]
    public async Task DeleteEventType_KeepsItsEventsWithoutType()
    {
        var type = await CreateType(Unique("Temporary"));
        var created = await (await CreateEvent(type.Id)).Content.ReadFromJsonAsync<EventResult>();

        var response = await _admin.DeleteAsync($"/api/event-types/{type.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var eventAfter = await _anonymous.GetFromJsonAsync<EventResult>($"/api/events/{created!.Id}");
        Assert.Null(eventAfter!.EventTypeId);
    }

    // ---------- TYPE ON AN EVENT ----------

    [Fact]
    public async Task CreateEvent_WithEventType_ReturnsTypeName()
    {
        var type = await CreateType(Unique("Workshop series"));

        var response = await CreateEvent(type.Id);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<EventResult>();
        Assert.Equal(type.Id, created!.EventTypeId);
        Assert.Equal(type.Name, created.EventTypeName);
    }

    [Fact]
    public async Task CreateEvent_WithUnknownEventType_Returns400()
    {
        var response = await CreateEvent(eventTypeId: 999_999);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SetEventType_SetsAndClearsTheType()
    {
        var type = await CreateType(Unique("Sports day"));
        var created = await (await CreateEvent(eventTypeId: null)).Content.ReadFromJsonAsync<EventResult>();

        var set = await _admin.PatchAsJsonAsync($"/api/events/{created!.Id}/event-type", new { eventTypeId = type.Id });
        var withType = await set.Content.ReadFromJsonAsync<EventResult>();

        var cleared = await _admin.PatchAsJsonAsync($"/api/events/{created.Id}/event-type", new { eventTypeId = (int?)null });
        var withoutType = await cleared.Content.ReadFromJsonAsync<EventResult>();

        Assert.Equal(HttpStatusCode.OK, set.StatusCode);
        Assert.Equal(type.Name, withType!.EventTypeName);
        Assert.Equal(HttpStatusCode.OK, cleared.StatusCode);
        Assert.Null(withoutType!.EventTypeId);
    }
}
