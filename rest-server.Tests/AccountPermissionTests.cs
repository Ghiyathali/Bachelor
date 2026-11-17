using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using RestServer.Auth;
using RestServer.Controllers;
using RestServer.Models;

namespace RestServer.Tests;

// FR-12 (updated): who may do what with accounts.
// Only an Admin may see/edit other accounts, create/delete accounts and change roles.
// Event Manager, Marketing Manager and Standard User: only their own account.
[Collection("API integration")]
public class AccountPermissionTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Password = "Password123";

    private async Task<(int Id, string Username)> CreateAccount(string role)
    {
        await using var db = factory.CreateDbContext();
        var name = "perm" + Guid.NewGuid().ToString("N")[..12];
        var account = new Account
        {
            Username = name,
            Email = name + "@test.example",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(Password, workFactor: 4),
            RoleId = (await db.Roles.SingleAsync(r => r.Name == role)).Id,
        };
        db.Accounts.Add(account);
        await db.SaveChangesAsync();
        return (account.Id, name);
    }

    private async Task<HttpClient> LogIn(string username) => await factory.CreateLoggedInClientAsync(username, Password);

    private static object Edit(string role, string? email = null, bool isActive = true) => new { role, isActive, email };

    private async Task<HttpStatusCode> LoginStatus(string username, string password)
    {
        using var client = factory.CreateHttpsClient();
        return (await client.PostAsJsonAsync("/api/auth/login", new { identifier = username, password })).StatusCode;
    }

    // Event Manager, Marketing Manager and Standard User: exactly the same account rights.
    public static TheoryData<string> NonAdminRoles => new() { RoleNames.EventManager, RoleNames.MarketingManager, RoleNames.StandardUser };

    [Theory]
    [MemberData(nameof(NonAdminRoles))]
    public async Task NonAdmin_CannotSeeOrEditOtherAccounts(string role)
    {
        var (targetId, targetName) = await CreateAccount(RoleNames.StandardUser);
        var (_, meName) = await CreateAccount(role);
        using var me = await LogIn(meName);

        var list = await me.GetAsync("/api/admin/accounts");
        var edit = await me.PutAsJsonAsync($"/api/admin/accounts/{targetId}", Edit(RoleNames.StandardUser, email: "x@x.example"));
        var deactivate = await me.PutAsJsonAsync($"/api/admin/accounts/{targetId}", Edit(RoleNames.StandardUser, isActive: false));
        var reset = await me.PutAsJsonAsync($"/api/admin/accounts/{targetId}/password", new { newPassword = "TakeOver123" });
        var unknown = await me.PutAsJsonAsync("/api/admin/accounts/2147483647", Edit(RoleNames.StandardUser));

        Assert.All([list, edit, deactivate, reset, unknown], r => Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode));
        Assert.Equal(HttpStatusCode.OK, await LoginStatus(targetName, Password));   // untouched
    }

    [Theory]
    [MemberData(nameof(NonAdminRoles))]
    public async Task NonAdmin_CanNeverTouchAnAdminAccount(string role)
    {
        var (adminId, adminName) = await CreateAccount(RoleNames.Admin);
        var (_, meName) = await CreateAccount(role);
        using var me = await LogIn(meName);

        var edit = await me.PutAsJsonAsync($"/api/admin/accounts/{adminId}", Edit(RoleNames.Admin, email: "taken@over.example"));
        var reset = await me.PutAsJsonAsync($"/api/admin/accounts/{adminId}/password", new { newPassword = "TakeOver123" });
        var delete = await me.DeleteAsync($"/api/admin/accounts/{adminId}");

        Assert.All([edit, reset, delete], r => Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode));
        Assert.Equal(HttpStatusCode.OK, await LoginStatus(adminName, Password));
    }

    [Theory]
    [MemberData(nameof(NonAdminRoles))]
    public async Task NonAdmin_CannotCreateDeleteOrChangeRoles(string role)
    {
        var (targetId, _) = await CreateAccount(RoleNames.StandardUser);
        var (meId, meName) = await CreateAccount(role);
        using var me = await LogIn(meName);
        var name = "new" + Guid.NewGuid().ToString("N")[..10];

        var create = await me.PostAsJsonAsync("/api/auth/register", new { email = name + "@test.example", username = name, password = Password });
        var delete = await me.DeleteAsync($"/api/admin/accounts/{targetId}");
        var promoteSelf = await me.PutAsJsonAsync($"/api/admin/accounts/{meId}", Edit(RoleNames.Admin));

        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, delete.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, promoteSelf.StatusCode);
        await using var db = factory.CreateDbContext();
        Assert.Equal(role, (await db.Accounts.Include(a => a.Role).SingleAsync(a => a.Id == meId)).Role.Name);
    }

    [Theory]
    [MemberData(nameof(NonAdminRoles))]
    public async Task NonAdmin_EditsTheirOwnDetailsAndPassword(string role)
    {
        var (meId, meName) = await CreateAccount(role);
        using var me = await LogIn(meName);

        var ownEdit = await me.PutAsJsonAsync($"/api/admin/accounts/{meId}", new { role, isActive = true, username = meName + "x", email = meName + "@mine.example" });
        var deactivateSelf = await me.PutAsJsonAsync($"/api/admin/accounts/{meId}", new { role, isActive = false });
        // Last, because a password change ends this login (old sessions stop working).
        var ownPassword = await me.PutAsJsonAsync($"/api/admin/accounts/{meId}/password", new { newPassword = "MyNewPassword1", currentPassword = Password });

        Assert.Equal(HttpStatusCode.OK, ownEdit.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, deactivateSelf.StatusCode);
        Assert.Equal(HttpStatusCode.OK, ownPassword.StatusCode);
        Assert.Equal(HttpStatusCode.OK, await LoginStatus(meName + "x", "MyNewPassword1"));
    }

    [Fact]
    public async Task StandardUser_SeesTheDashboard()
    {
        var (_, name) = await CreateAccount(RoleNames.StandardUser);
        using var user = await LogIn(name);

        Assert.Equal(HttpStatusCode.OK, (await user.GetAsync("/api/dashboard/overview")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await user.GetAsync("/api/events/walk-ins")).StatusCode);
    }

    [Fact]
    public async Task Admin_StillChangesRoles_AndEditsAdmins()
    {
        var (targetId, _) = await CreateAccount(RoleNames.StandardUser);
        var (otherAdminId, _) = await CreateAccount(RoleNames.Admin);
        using var admin = await factory.CreateAdminClientAsync();

        var promote = await admin.PutAsJsonAsync($"/api/admin/accounts/{targetId}", Edit(RoleNames.MarketingManager));
        var editAdmin = await admin.PutAsJsonAsync($"/api/admin/accounts/{otherAdminId}", Edit(RoleNames.Admin, isActive: false));

        Assert.Equal(HttpStatusCode.OK, promote.StatusCode);
        Assert.Equal(RoleNames.MarketingManager, (await promote.Content.ReadFromJsonAsync<AccountResponse>())!.Role);
        Assert.Equal(HttpStatusCode.OK, editAdmin.StatusCode);
    }
}
