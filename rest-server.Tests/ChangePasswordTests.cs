using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using RestServer.Auth;
using RestServer.Controllers;
using RestServer.Models;

namespace RestServer.Tests;

// Changing a password in Manage accounts → Edit: an Admin resets someone else's password,
// or changes their own (then the current password is required). Old logins stop working.
[Collection("API integration")]
public class ChangePasswordTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string OldPassword = "OldPassword1";
    private const string NewPassword = "NewPassword2";

    // A fresh account per test, so tests never change each other's passwords.
    private async Task<(int Id, string Username)> CreateAccount(string role)
    {
        await using var db = factory.CreateDbContext();
        var name = "pw" + Guid.NewGuid().ToString("N")[..12];
        var account = new Account
        {
            Username = name,
            Email = name + "@test.example",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(OldPassword, workFactor: 4),
            RoleId = (await db.Roles.SingleAsync(r => r.Name == role)).Id,
        };
        db.Accounts.Add(account);
        await db.SaveChangesAsync();
        return (account.Id, name);
    }

    private async Task<HttpStatusCode> LoginStatus(string username, string password)
    {
        using var client = factory.CreateHttpsClient();
        return (await client.PostAsJsonAsync("/api/auth/login", new { identifier = username, password })).StatusCode;
    }

    [Fact]
    public async Task Admin_ResetsAnotherAccount_NewPasswordWorks_OldOneDoesNot()
    {
        var (id, name) = await CreateAccount(RoleNames.EventManager);
        using var admin = await factory.CreateAdminClientAsync();

        var response = await admin.PutAsJsonAsync($"/api/admin/accounts/{id}/password", new { newPassword = NewPassword });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Null((await response.Content.ReadFromJsonAsync<ChangePasswordResponse>())!.Token);   // no token for someone else
        Assert.Equal(HttpStatusCode.OK, await LoginStatus(name, NewPassword));
        Assert.Equal(HttpStatusCode.Unauthorized, await LoginStatus(name, OldPassword));
    }

    [Fact]
    public async Task AfterAReset_TheOldLoginOfThatAccountStopsWorking()
    {
        var (id, name) = await CreateAccount(RoleNames.MarketingManager);
        using var user = await factory.CreateLoggedInClientAsync(name, OldPassword);
        Assert.Equal(HttpStatusCode.OK, (await user.GetAsync("/api/auth/me")).StatusCode);
        await Task.Delay(1100);   // tokens store their time in whole seconds
        using var admin = await factory.CreateAdminClientAsync();

        await admin.PutAsJsonAsync($"/api/admin/accounts/{id}/password", new { newPassword = NewPassword });

        Assert.Equal(HttpStatusCode.Unauthorized, (await user.GetAsync("/api/auth/me")).StatusCode);
    }

    [Theory]
    [InlineData("short7c")]   // 7 characters
    [InlineData("")]
    public async Task TooShortPassword_IsRejected(string newPassword)
    {
        var (id, name) = await CreateAccount(RoleNames.StandardUser);
        using var admin = await factory.CreateAdminClientAsync();

        var response = await admin.PutAsJsonAsync($"/api/admin/accounts/{id}/password", new { newPassword });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, await LoginStatus(name, OldPassword));   // unchanged
    }

    [Fact]
    public async Task TooLongPassword_IsRejected()
    {
        var (id, _) = await CreateAccount(RoleNames.StandardUser);
        using var admin = await factory.CreateAdminClientAsync();

        var response = await admin.PutAsJsonAsync($"/api/admin/accounts/{id}/password", new { newPassword = new string('a', 73) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ExactlyEightAndSeventyTwoCharacters_AreAllowed()
    {
        var (id, name) = await CreateAccount(RoleNames.StandardUser);
        using var admin = await factory.CreateAdminClientAsync();

        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/admin/accounts/{id}/password", new { newPassword = "eight888" })).StatusCode);
        var longest = new string('b', 72);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/admin/accounts/{id}/password", new { newPassword = longest })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, await LoginStatus(name, longest));
    }

    [Fact]
    public async Task SamePasswordAsBefore_IsRejected()
    {
        var (id, _) = await CreateAccount(RoleNames.StandardUser);
        using var admin = await factory.CreateAdminClientAsync();

        var response = await admin.PutAsJsonAsync($"/api/admin/accounts/{id}/password", new { newPassword = OldPassword });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task OwnPassword_WithoutOrWithWrongCurrentPassword_IsRejected_AndNotLoggedOut()
    {
        var (id, name) = await CreateAccount(RoleNames.Admin);
        using var me = await factory.CreateLoggedInClientAsync(name, OldPassword);

        var missing = await me.PutAsJsonAsync($"/api/admin/accounts/{id}/password", new { newPassword = NewPassword });
        var wrong = await me.PutAsJsonAsync($"/api/admin/accounts/{id}/password", new { newPassword = NewPassword, currentPassword = "WrongPassword9" });

        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);   // 400, so the app does not log you out
        Assert.Equal(HttpStatusCode.OK, (await me.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, await LoginStatus(name, OldPassword));   // unchanged
    }

    [Fact]
    public async Task OwnPassword_WithCurrentPassword_Works_AndGivesANewLogin()
    {
        var (id, name) = await CreateAccount(RoleNames.Admin);
        using var me = await factory.CreateLoggedInClientAsync(name, OldPassword);
        await Task.Delay(1100);   // tokens store their time in whole seconds

        var response = await me.PutAsJsonAsync($"/api/admin/accounts/{id}/password", new { newPassword = NewPassword, currentPassword = OldPassword });
        var body = await response.Content.ReadFromJsonAsync<ChangePasswordResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(string.IsNullOrEmpty(body!.Token));
        // The old login stops working, the new token from the response keeps you logged in.
        Assert.Equal(HttpStatusCode.Unauthorized, (await me.GetAsync("/api/auth/me")).StatusCode);
        me.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.Token);
        Assert.Equal(HttpStatusCode.OK, (await me.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, await LoginStatus(name, NewPassword));
        Assert.Equal(HttpStatusCode.Unauthorized, await LoginStatus(name, OldPassword));
    }

    [Fact]
    public async Task UnknownAccount_Returns404()
    {
        using var admin = await factory.CreateAdminClientAsync();

        var response = await admin.PutAsJsonAsync("/api/admin/accounts/2147483647/password", new { newPassword = NewPassword });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task StandardUser_CannotChangeSomeoneElsesPassword()
    {
        var (targetId, targetName) = await CreateAccount(RoleNames.StandardUser);
        var (_, userName) = await CreateAccount(RoleNames.StandardUser);
        using var user = await factory.CreateLoggedInClientAsync(userName, OldPassword);

        var response = await user.PutAsJsonAsync($"/api/admin/accounts/{targetId}/password", new { newPassword = NewPassword });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, await LoginStatus(targetName, OldPassword));
    }
}
