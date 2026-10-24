using System.Net;
using System.Net.Http.Json;

namespace RestServer.Tests;

// Integration tests: each test sends a real HTTP request through the whole
// REST server (routing, validation, auth, controller, EF Core) to a real PostgreSQL.
public class AuthEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncLifetime
{
    // A stranger: no token.
    private readonly HttpClient _anonymous = factory.CreateHttpsClient();

    // Logged in as the test Admin (only Admins may create accounts, #52).
    private HttpClient _admin = null!;

    private const string ValidPassword = "CorrectHorse1";

    public async Task InitializeAsync() => _admin = await factory.CreateAdminClientAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    // Unique per test, so the tests never collide in the shared test database.
    private static string NewUsername() => "user" + Guid.NewGuid().ToString("N")[..12];

    private static Task<HttpResponseMessage> Register(HttpClient client, string email, string username, string password) =>
        client.PostAsJsonAsync("/api/auth/register", new { email, username, password });

    private Task<HttpResponseMessage> Login(string identifier, string password) =>
        _anonymous.PostAsJsonAsync("/api/auth/login", new { identifier, password });

    private record LoginResult(string Token, DateTimeOffset ExpiresAt, string Username, string Email, string Role);

    // ---------- CREATE ACCOUNT: who may do it ----------

    [Fact]
    public async Task Register_AsAdmin_WithValidInput_Returns201()
    {
        var username = NewUsername();

        var response = await Register(_admin, $"{username}@test.example", username, ValidPassword);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task Register_WithoutToken_Returns401()
    {
        var username = NewUsername();

        var response = await Register(_anonymous, $"{username}@test.example", username, ValidPassword);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Register_AsNonAdmin_Returns403()
    {
        // The Admin creates a normal "User" account, which then tries to create another account.
        var username = NewUsername();
        await Register(_admin, $"{username}@test.example", username, ValidPassword);
        var userClient = await factory.CreateLoggedInClientAsync(username, ValidPassword);

        var other = NewUsername();
        var response = await Register(userClient, $"{other}@test.example", other, ValidPassword);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ---------- CREATE ACCOUNT: validation ----------

    [Fact]
    public async Task Register_WithDuplicateEmail_Returns409()
    {
        var username = NewUsername();
        var email = $"{username}@test.example";
        await Register(_admin, email, username, ValidPassword);

        var response = await Register(_admin, email, NewUsername(), ValidPassword);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Register_WithDuplicateUsername_Returns409()
    {
        var username = NewUsername();
        await Register(_admin, $"{username}@test.example", username, ValidPassword);

        var response = await Register(_admin, $"other-{username}@test.example", username, ValidPassword);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Register_WithTooShortPassword_Returns400()
    {
        var username = NewUsername();

        var response = await Register(_admin, $"{username}@test.example", username, "short");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---------- LOG IN (still open to everyone) ----------

    [Fact]
    public async Task Login_WithCorrectPassword_Returns200AndToken()
    {
        var username = NewUsername();
        await Register(_admin, $"{username}@test.example", username, ValidPassword);

        var response = await Login(username, ValidPassword);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<LoginResult>();
        Assert.False(string.IsNullOrWhiteSpace(body?.Token));
    }

    [Fact]
    public async Task Login_WithWrongPassword_Returns401()
    {
        var username = NewUsername();
        await Register(_admin, $"{username}@test.example", username, ValidPassword);

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
        var response = await _anonymous.GetAsync("/api/dashboard/overview");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
