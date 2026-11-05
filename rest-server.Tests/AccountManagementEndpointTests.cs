using System.Net;
using System.Net.Http.Json;
using RestServer.Auth;
using RestServer.Controllers;

namespace RestServer.Tests;

[Collection("API integration")]
public class AccountManagementEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Password = "AccountPassword123";
    private static string NewUsername() => "edit" + Guid.NewGuid().ToString("N")[..12];

    private async Task<RegisterResponse> CreateAccount(HttpClient admin)
    {
        var username = NewUsername();
        using var response = await admin.PostAsJsonAsync("/api/auth/register",
            new { username, email = username + "@test.example", password = Password });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<RegisterResponse>())!;
    }

    [Fact]
    public async Task Edit_NormalizesDetails_UpdatesExistingSession_AndUsesNewLoginIdentifiers()
    {
        using var admin = await factory.CreateAdminClientAsync();
        var account = await CreateAccount(admin);
        using var session = await factory.CreateLoggedInClientAsync(account.Username, Password);
        var username = NewUsername();
        var email = username + "@test.example";
        using var response = await admin.PutAsJsonAsync($"/api/admin/accounts/{account.Id}",
            new { username = username.ToUpperInvariant(), email = email.ToUpperInvariant(), role = RoleNames.StandardUser, isActive = true });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var edited = (await response.Content.ReadFromJsonAsync<AccountResponse>())!;
        Assert.Equal(username, edited.Username);
        Assert.Equal(email, edited.Email);
        var me = await session.GetFromJsonAsync<MeResponse>("/api/auth/me");
        Assert.Equal(username, me!.Username);
        Assert.Equal(email, me.Email);
        using var anonymous = factory.CreateHttpsClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/auth/login",
            new { identifier = account.Username, password = Password })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/auth/login",
            new { identifier = account.Email, password = Password })).StatusCode);
        using var byUsername = await factory.CreateLoggedInClientAsync(username, Password);
        using var byEmail = await factory.CreateLoggedInClientAsync(email, Password);
        Assert.Equal(HttpStatusCode.OK, (await byUsername.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await byEmail.GetAsync("/api/auth/me")).StatusCode);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Edit_DuplicateDetails_Return409WithoutChangingAccount(bool duplicateUsername)
    {
        using var admin = await factory.CreateAdminClientAsync();
        var first = await CreateAccount(admin);
        var second = await CreateAccount(admin);
        var response = await admin.PutAsJsonAsync($"/api/admin/accounts/{second.Id}", new {
            username = duplicateUsername ? first.Username.ToUpperInvariant() : second.Username,
            email = duplicateUsername ? second.Email : first.Email.ToUpperInvariant(),
            role = RoleNames.EventManager, isActive = false });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var unchanged = (await admin.GetFromJsonAsync<List<AccountResponse>>("/api/admin/accounts"))!.Single(a => a.Id == second.Id);
        Assert.Equal(second.Username, unchanged.Username);
        Assert.Equal(second.Email, unchanged.Email);
        Assert.Equal(RoleNames.StandardUser, unchanged.Role);
        Assert.True(unchanged.IsActive);
    }

    [Theory]
    [InlineData("ab", "valid@test.example")]
    [InlineData("", "valid@test.example")]
    [InlineData("has space", "valid@test.example")]
    [InlineData("has@symbol", "valid@test.example")]
    [InlineData("validusername", "invalid-email")]
    [InlineData("validusername", "")]
    [InlineData("abcdefghijklmnopqrstuvwxyz12345", "valid@test.example")]
    public async Task Edit_InvalidDetails_Return400(string username, string email)
    {
        using var admin = await factory.CreateAdminClientAsync();
        var account = await CreateAccount(admin);
        var response = await admin.PutAsJsonAsync($"/api/admin/accounts/{account.Id}",
            new { username, email, role = RoleNames.StandardUser, isActive = true });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Edit_AdminCanChangeOwnDetails_ButCannotDeleteOwnAccount()
    {
        using var admin = await factory.CreateAdminClientAsync();
        var originalUsername = NewUsername();
        var created = await admin.PostAsJsonAsync("/api/auth/register", new {
            username = originalUsername, email = originalUsername + "@test.example", password = Password, role = RoleNames.Admin });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        using var self = await factory.CreateLoggedInClientAsync(originalUsername, Password);
        var me = (await self.GetFromJsonAsync<MeResponse>("/api/auth/me"))!;
        var username = NewUsername();
        Assert.Equal(HttpStatusCode.OK, (await self.PutAsJsonAsync($"/api/admin/accounts/{me.Id}",
            new { username, email = username + "@test.example", role = RoleNames.Admin, isActive = true })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await self.DeleteAsync($"/api/admin/accounts/{me.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await self.GetAsync("/api/admin/accounts")).StatusCode);
    }

    [Fact]
    public async Task Delete_RemovesAccount_BlocksLoginAndExistingToken_AndReturns404IfMissing()
    {
        using var admin = await factory.CreateAdminClientAsync();
        var account = await CreateAccount(admin);
        using var session = await factory.CreateLoggedInClientAsync(account.Username, Password);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/admin/accounts/{account.Id}")).StatusCode);
        Assert.DoesNotContain((await admin.GetFromJsonAsync<List<AccountResponse>>("/api/admin/accounts"))!, a => a.Id == account.Id);
        Assert.Equal(HttpStatusCode.Unauthorized, (await session.GetAsync("/api/auth/me")).StatusCode);
        using var anonymous = factory.CreateHttpsClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/auth/login",
            new { identifier = account.Username, password = Password })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.DeleteAsync($"/api/admin/accounts/{account.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PutAsJsonAsync($"/api/admin/accounts/{account.Id}",
            new { username = account.Username, email = account.Email, role = RoleNames.StandardUser, isActive = true })).StatusCode);
    }

    private record MeResponse(string Id, string Username, string Email);
}
