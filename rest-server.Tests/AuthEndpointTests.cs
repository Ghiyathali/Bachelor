using System.Net;
using System.Net.Http.Json;

namespace RestServer.Tests;

// Integration tests: each test sends a real HTTP request through the whole
// REST server (routing, validation, controller, EF Core) to a real PostgreSQL.
public class AuthEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateHttpsClient();

    private const string ValidPassword = "CorrectHorse1";

    // Unique per test, so the tests never collide in the shared test database.
    private static string NewUsername() => "user" + Guid.NewGuid().ToString("N")[..12];

    private Task<HttpResponseMessage> Register(string email, string username, string password) =>
        _client.PostAsJsonAsync("/api/auth/register", new { email, username, password });

    private Task<HttpResponseMessage> Login(string identifier, string password) =>
        _client.PostAsJsonAsync("/api/auth/login", new { identifier, password });

    private record LoginResult(string Token, DateTimeOffset ExpiresAt, string Username, string Email, string Role);

    // ---------- REGISTER ----------

    [Fact]
    public async Task Register_WithValidInput_Returns201()
    {
        var username = NewUsername();

        var response = await Register($"{username}@test.example", username, ValidPassword);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task Register_WithDuplicateEmail_Returns409()
    {
        var username = NewUsername();
        var email = $"{username}@test.example";
        await Register(email, username, ValidPassword);

        var response = await Register(email, NewUsername(), ValidPassword);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Register_WithDuplicateUsername_Returns409()
    {
        var username = NewUsername();
        await Register($"{username}@test.example", username, ValidPassword);

        var response = await Register($"other-{username}@test.example", username, ValidPassword);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Register_WithTooShortPassword_Returns400()
    {
        var username = NewUsername();

        var response = await Register($"{username}@test.example", username, "short");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---------- LOG IN ----------

    [Fact]
    public async Task Login_WithCorrectPassword_Returns200AndToken()
    {
        var username = NewUsername();
        await Register($"{username}@test.example", username, ValidPassword);

        var response = await Login(username, ValidPassword);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<LoginResult>();
        Assert.False(string.IsNullOrWhiteSpace(body?.Token));
    }

    [Fact]
    public async Task Login_WithWrongPassword_Returns401()
    {
        var username = NewUsername();
        await Register($"{username}@test.example", username, ValidPassword);

        var response = await Login(username, "WrongPassword1");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_WithUnknownUser_Returns401()
    {
        var response = await Login(NewUsername(), ValidPassword);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ---------- PROTECTED ENDPOINT ----------

    [Fact]
    public async Task DashboardOverview_WithoutToken_Returns401()
    {
        var response = await _client.GetAsync("/api/dashboard/overview");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
