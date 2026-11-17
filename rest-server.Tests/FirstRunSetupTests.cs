using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using RestServer.Auth;
using RestServer.Controllers;

namespace RestServer.Tests;

// First start on a brand-new database: the app creates its tables by itself, and the first
// Admin is created from the login page. One test runs the whole first start in order,
// because every step depends on the one before (there can only ever be one "first" Admin).
[Collection("API integration")]
public class FirstRunSetupTests(EmptyDatabaseFactory factory) : IClassFixture<EmptyDatabaseFactory>
{
    private const string Password = "JurgitaPass1";

    [Fact]
    public async Task FirstStart_CreatesTables_ThenOneFirstAdmin_ThenNormalLoginOnly()
    {
        using var client = factory.CreateHttpsClient();   // starts the app on the empty database

        // 1. The app created every table by itself.
        await using (var db = factory.CreateDbContext())
        {
            Assert.Empty(await db.Database.GetPendingMigrationsAsync());
            Assert.NotEmpty(await db.Database.GetAppliedMigrationsAsync());
            Assert.Equal(0, await db.Accounts.CountAsync());
        }

        // 2. No Admin yet, so the login page must offer the setup.
        var status = await client.GetFromJsonAsync<SetupStatusResponse>("/api/setup/status");
        Assert.True(status!.NeedsFirstAdmin);

        // 3. Wrong details are refused, and nothing is created.
        foreach (var bad in new object[]
        {
            new { username = "ju", email = "jurgita@pangaeayouth.org", password = Password },            // username too short
            new { username = "Jurgita", email = "not-an-email", password = Password },
            new { username = "Jurgita", email = "jurgita@pangaeayouth.org", password = "short7c" },        // 7 characters
        })
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/setup/first-admin", bad)).StatusCode);
        Assert.True((await client.GetFromJsonAsync<SetupStatusResponse>("/api/setup/status"))!.NeedsFirstAdmin);

        // 4. Two people press "Create" at the same moment: exactly one Admin is created.
        var attempts = await Task.WhenAll(
            client.PostAsJsonAsync("/api/setup/first-admin", new { username = "Jurgita", email = "jurgita@pangaeayouth.org", password = Password }),
            client.PostAsJsonAsync("/api/setup/first-admin", new { username = "Someone", email = "someone@example.org", password = Password }));
        Assert.Single(attempts, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(attempts, r => r.StatusCode == HttpStatusCode.Conflict);
        await using (var db = factory.CreateDbContext())
            Assert.Equal(1, await db.Accounts.CountAsync(a => a.Role.Name == RoleNames.Admin));

        // 5. The winner is logged straight in as Admin and can manage accounts.
        var winner = attempts.Single(r => r.StatusCode == HttpStatusCode.OK);
        var login = await winner.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.Equal(RoleNames.Admin, login!.Role);
        using var admin = factory.CreateHttpsClient();
        admin.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.Token);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/admin/accounts")).StatusCode);

        // 6. From now on the setup is closed for good, and the normal login works.
        Assert.False((await client.GetFromJsonAsync<SetupStatusResponse>("/api/setup/status"))!.NeedsFirstAdmin);
        var again = await client.PostAsJsonAsync("/api/setup/first-admin", new { username = "Intruder", email = "intruder@example.org", password = Password });
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        var normalLogin = await client.PostAsJsonAsync("/api/auth/login", new { identifier = login.Username, password = Password });
        Assert.Equal(HttpStatusCode.OK, normalLogin.StatusCode);
    }
}
