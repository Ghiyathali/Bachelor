using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.EntityFrameworkCore;
using RestServer.Auth;
using RestServer.Controllers;
using RestServer.Models;

namespace RestServer.Tests;

[Collection("API integration")]
public class RoleAuthorizationTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly string[] Roles = [RoleNames.Admin, RoleNames.EventManager, RoleNames.MarketingManager, RoleNames.StandardUser];
    private static readonly (string Method, string Path, string Allowed, object? Body)[] Endpoints =
    [
        ("GET", "/api/auth/me", RoleNames.All, null),
        ("POST", "/api/auth/register", RoleNames.Admin, new { email = "bad", username = "x", password = "x" }),
        ("GET", "/api/admin/accounts", RoleNames.Admin, null),
        ("DELETE", "/api/admin/accounts/2147483647", RoleNames.Admin, null),
        ("PUT", "/api/admin/accounts/2147483647", RoleNames.Admin, new { role = RoleNames.StandardUser, isActive = false }),
        ("GET", "/api/admin/pyn-sync/last", RoleNames.Admin, null),
        // Uses the disposable database as its mock PYN source.
        ("POST", "/api/admin/pyn-sync", RoleNames.Admin, null),
        ("GET", "/api/dashboard/overview", RoleNames.Analytics, null),
        ("GET", "/api/dashboard/satisfaction", RoleNames.Analytics, null),
        ("GET", "/api/dashboard/attendance", RoleNames.Analytics, null),
        ("GET", "/api/dashboard/trends", RoleNames.Analytics, null),
        ("GET", "/api/dashboard/event-types", RoleNames.Analytics, null),
        ("GET", "/api/event-types", RoleNames.Analytics, null),
        ("POST", "/api/event-types", RoleNames.EventManagement, new { name = "" }),
        ("PUT", "/api/event-types/2147483647", RoleNames.EventManagement, new { name = "Test" }),
        ("DELETE", "/api/event-types/2147483647", RoleNames.EventManagement, null),
        ("POST", "/api/events", RoleNames.EventManagement, new { name = "" }),
        ("PATCH", "/api/events/2147483647/feedback-status", RoleNames.EventManagement, new { isFeedbackOpen = true }),
        ("PATCH", "/api/events/2147483647/event-type", RoleNames.EventManagement, new { eventTypeId = (int?)null }),
    ];

    public static IEnumerable<object[]> Matrix() => Roles.SelectMany(role => Endpoints.Select((_, index) => new object[] { role, index }));

    private async Task<(HttpClient Client, int Id)> ClientForRole(string role)
    {
        await using var db = factory.CreateDbContext();
        var name = "role" + Guid.NewGuid().ToString("N")[..12];
        var account = new Account { Username = name, Email = name + "@test.example",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123", workFactor: 4),
            RoleId = (await db.Roles.SingleAsync(r => r.Name == role)).Id };
        db.Accounts.Add(account);
        await db.SaveChangesAsync();
        return (await factory.CreateLoggedInClientAsync(name, "Password123"), account.Id);
    }

    [Theory]
    [MemberData(nameof(Matrix))]
    public async Task EveryProtectedEndpoint_EnforcesRole(string role, int index)
    {
        var (client, _) = await ClientForRole(role);
        using (client)
        {
            var endpoint = Endpoints[index];
            if (endpoint.Path == "/api/admin/pyn-sync" && role == RoleNames.Admin) await factory.CreatePynMockAsync();
            using var request = new HttpRequestMessage(new HttpMethod(endpoint.Method), endpoint.Path);
            if (endpoint.Body is not null) request.Content = JsonContent.Create(endpoint.Body);
            using var response = await client.SendAsync(request);
            if (!endpoint.Allowed.Split(',').Contains(role))
                Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            else
            {
                Assert.NotEqual(HttpStatusCode.Forbidden, response.StatusCode);
                Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
                Assert.True((int)response.StatusCode < 500, $"{endpoint.Path}: {response.StatusCode}");
            }
        }
    }

    [Fact]
    public async Task EveryProtectedEndpoint_RejectsAnonymous()
    {
        using var client = factory.CreateHttpsClient();
        foreach (var endpoint in Endpoints)
        {
            using var request = new HttpRequestMessage(new HttpMethod(endpoint.Method), endpoint.Path);
            if (endpoint.Body is not null) request.Content = JsonContent.Create(endpoint.Body);
            using var response = await client.SendAsync(request);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }

    [Theory]
    [InlineData(null)]
    [InlineData(RoleNames.Admin)]
    [InlineData(RoleNames.EventManager)]
    [InlineData(RoleNames.MarketingManager)]
    [InlineData(RoleNames.StandardUser)]
    public async Task PublicFeedbackEndpoints_RemainAccessible(string? role)
    {
        using var client = role is null ? factory.CreateHttpsClient() : (await ClientForRole(role)).Client;
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/events")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/events/2147483647")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/feedback/stats")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync("/api/events/2147483647/feedback",
            new { rating = 5, usefulnessRating = 5, inclusionRating = 5 })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login",
            new { identifier = "missing", password = "Password123" })).StatusCode);
    }

    [Fact]
    public void EveryControllerAction_DeclaresAccessExplicitly()
    {
        var actions = typeof(AuthController).Assembly.GetTypes()
            .Where(t => t.IsSubclassOf(typeof(ControllerBase)))
            .SelectMany(t => t.GetMethods().Where(m => m.GetCustomAttributes(typeof(HttpMethodAttribute), true).Length > 0));
        foreach (var action in actions)
        {
            var attributes = action.GetCustomAttributes(true).Concat(action.DeclaringType!.GetCustomAttributes(true));
            Assert.True(attributes.OfType<AllowAnonymousAttribute>().Any() ||
                attributes.OfType<AuthorizeAttribute>().Any(a => !string.IsNullOrEmpty(a.Roles)), action.Name);
        }
    }

    [Fact]
    public async Task Admin_CreatesAssignsDeactivatesAndReactivatesAccount_ExistingTokenIsChecked()
    {
        using var admin = await factory.CreateAdminClientAsync();
        var name = "managed" + Guid.NewGuid().ToString("N")[..12];
        var created = await admin.PostAsJsonAsync("/api/auth/register", new { email = name + "@test.example", username = name,
            password = "Password123", role = RoleNames.EventManager });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var account = (await created.Content.ReadFromJsonAsync<RegisterResponse>())!;
        Assert.Equal(RoleNames.EventManager, account.Role);
        using var client = await factory.CreateLoggedInClientAsync(name, "Password123");
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/dashboard/overview")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/admin/accounts/{account.Id}",
            new { role = RoleNames.StandardUser, isActive = true })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/dashboard/overview")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/admin/accounts/{account.Id}",
            new { role = RoleNames.StandardUser, isActive = false })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        using var anonymous = factory.CreateHttpsClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/auth/login",
            new { identifier = name, password = "Password123" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/admin/accounts/{account.Id}",
            new { role = RoleNames.MarketingManager, isActive = true })).StatusCode);
        using var reactivated = await factory.CreateLoggedInClientAsync(name, "Password123");
        Assert.Equal(HttpStatusCode.OK, (await reactivated.GetAsync("/api/dashboard/overview")).StatusCode);
    }

    [Fact]
    public async Task Admin_RejectsUnknownRolesAndSelfDeactivation()
    {
        var (admin, id) = await ClientForRole(RoleNames.Admin);
        using (admin)
        {
            Assert.Equal(HttpStatusCode.Conflict, (await admin.PutAsJsonAsync($"/api/admin/accounts/{id}", new { role = RoleNames.Admin, isActive = false })).StatusCode);
            Assert.Equal(HttpStatusCode.Conflict, (await admin.PutAsJsonAsync($"/api/admin/accounts/{id}", new { role = RoleNames.StandardUser, isActive = true })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync($"/api/admin/accounts/{id}", new { role = "User", isActive = true })).StatusCode);
        }
    }
}
