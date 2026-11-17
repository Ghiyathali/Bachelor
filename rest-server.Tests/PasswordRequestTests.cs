using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using RestServer.Auth;
using RestServer.Controllers;
using RestServer.Models;

namespace RestServer.Tests;

// "Forgot password?": the user asks for a new password, an Admin approves or declines it.
// Nothing changes before the approval, and the form never reveals whether an account exists.
[Collection("API integration")]
public class PasswordRequestTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string OldPassword = "OldPassword1";
    private const string NewPassword = "NewPassword2";

    private async Task<(int Id, string Username)> CreateAccount(string role = RoleNames.StandardUser, bool active = true)
    {
        await using var db = factory.CreateDbContext();
        var name = "fp" + Guid.NewGuid().ToString("N")[..12];
        var account = new Account
        {
            Username = name,
            Email = name + "@test.example",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(OldPassword, workFactor: 4),
            RoleId = (await db.Roles.SingleAsync(r => r.Name == role)).Id,
            IsActive = active,
        };
        db.Accounts.Add(account);
        await db.SaveChangesAsync();
        return (account.Id, name);
    }

    private async Task<HttpResponseMessage> Forgot(string identifier, string newPassword = NewPassword)
    {
        using var anonymous = factory.CreateHttpsClient();
        return await anonymous.PostAsJsonAsync("/api/auth/forgot-password", new { identifier, newPassword });
    }

    private async Task<HttpStatusCode> LoginStatus(string username, string password)
    {
        using var client = factory.CreateHttpsClient();
        return (await client.PostAsJsonAsync("/api/auth/login", new { identifier = username, password })).StatusCode;
    }

    private async Task<PasswordRequestResponse?> RequestFor(HttpClient admin, int accountId) =>
        (await admin.GetFromJsonAsync<List<PasswordRequestResponse>>("/api/admin/password-requests"))!
            .SingleOrDefault(r => r.AccountId == accountId);

    [Fact]
    public async Task Request_ChangesNothing_UntilTheAdminApproves()
    {
        var (id, name) = await CreateAccount();
        using var admin = await factory.CreateAdminClientAsync();

        var sent = await Forgot(name + "@test.example");   // by email
        Assert.Equal(HttpStatusCode.Accepted, sent.StatusCode);
        Assert.Equal(HttpStatusCode.OK, await LoginStatus(name, OldPassword));          // old one still works
        Assert.Equal(HttpStatusCode.Unauthorized, await LoginStatus(name, NewPassword)); // new one not yet

        var request = await RequestFor(admin, id);
        Assert.NotNull(request);
        Assert.Equal(name, request!.Username);

        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsync($"/api/admin/password-requests/{request.Id}/approve", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, await LoginStatus(name, NewPassword));
        Assert.Equal(HttpStatusCode.Unauthorized, await LoginStatus(name, OldPassword));
        Assert.Null(await RequestFor(admin, id));   // the request is gone from the bell
    }

    [Fact]
    public async Task Declined_KeepsTheOldPassword()
    {
        var (id, name) = await CreateAccount();
        using var admin = await factory.CreateAdminClientAsync();
        await Forgot(name);   // by username

        var request = await RequestFor(admin, id);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsync($"/api/admin/password-requests/{request!.Id}/decline", null)).StatusCode);

        Assert.Equal(HttpStatusCode.OK, await LoginStatus(name, OldPassword));
        Assert.Equal(HttpStatusCode.Unauthorized, await LoginStatus(name, NewPassword));
        Assert.Null(await RequestFor(admin, id));
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync($"/api/admin/password-requests/{request.Id}/approve", null)).StatusCode);
    }

    [Fact]
    public async Task UnknownOrInactiveAccount_GetsTheSameAnswer_AndNoRequest()
    {
        var (inactiveId, inactiveName) = await CreateAccount(active: false);
        using var admin = await factory.CreateAdminClientAsync();

        var unknown = await Forgot("nobody-" + Guid.NewGuid().ToString("N")[..8]);
        var inactive = await Forgot(inactiveName);

        Assert.Equal(HttpStatusCode.Accepted, unknown.StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, inactive.StatusCode);
        Assert.Equal(await unknown.Content.ReadAsStringAsync(), await inactive.Content.ReadAsStringAsync());
        Assert.Null(await RequestFor(admin, inactiveId));
    }

    [Fact]
    public async Task InvalidNewPassword_IsRejected()
    {
        var (_, name) = await CreateAccount();

        Assert.Equal(HttpStatusCode.BadRequest, (await Forgot(name, "short7c")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Forgot(name, new string('a', 73))).StatusCode);
    }

    [Fact]
    public async Task ANewRequest_ReplacesTheOldOne()
    {
        var (id, name) = await CreateAccount();
        using var admin = await factory.CreateAdminClientAsync();
        await Forgot(name, "FirstTry1234");
        await Forgot(name, "SecondTry1234");

        var request = await RequestFor(admin, id);
        await admin.PostAsync($"/api/admin/password-requests/{request!.Id}/approve", null);

        Assert.Equal(HttpStatusCode.OK, await LoginStatus(name, "SecondTry1234"));
        Assert.Equal(HttpStatusCode.Unauthorized, await LoginStatus(name, "FirstTry1234"));
    }

    [Fact]
    public async Task RequestsOlderThan24Hours_Expire()
    {
        var (id, name) = await CreateAccount();
        using var admin = await factory.CreateAdminClientAsync();
        await Forgot(name);
        await using (var db = factory.CreateDbContext())
        {
            var request = await db.PasswordResetRequests.SingleAsync(r => r.AccountId == id);
            request.CreatedAt = DateTimeOffset.UtcNow.AddHours(-25);
            await db.SaveChangesAsync();
        }

        Assert.Null(await RequestFor(admin, id));
        Assert.Equal(HttpStatusCode.OK, await LoginStatus(name, OldPassword));
    }

    [Theory]
    [InlineData(RoleNames.EventManager)]
    [InlineData(RoleNames.MarketingManager)]
    [InlineData(RoleNames.StandardUser)]
    public async Task OnlyAnAdmin_SeesAndApprovesRequests(string role)
    {
        var (targetId, targetName) = await CreateAccount();
        var (_, otherName) = await CreateAccount(role);
        await Forgot(targetName);
        using var admin = await factory.CreateAdminClientAsync();
        var request = await RequestFor(admin, targetId);
        using var other = await factory.CreateLoggedInClientAsync(otherName, OldPassword);

        Assert.Equal(HttpStatusCode.Forbidden, (await other.GetAsync("/api/admin/password-requests")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await other.PostAsync($"/api/admin/password-requests/{request!.Id}/approve", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, await LoginStatus(targetName, OldPassword));
    }

    [Fact]
    public async Task TheNewPassword_IsOnlyStoredAsAHash()
    {
        var (id, name) = await CreateAccount();
        await Forgot(name);

        await using var db = factory.CreateDbContext();
        var request = await db.PasswordResetRequests.SingleAsync(r => r.AccountId == id);
        Assert.DoesNotContain(NewPassword, request.NewPasswordHash);
        Assert.True(BCrypt.Net.BCrypt.Verify(NewPassword, request.NewPasswordHash));
    }
}
