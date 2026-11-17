using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using RestServer.Controllers;

namespace RestServer.Tests;

// A database that already has an Admin (like ours, or PYN's after the first start):
// the setup must stay closed, even for someone who calls the API directly.
[Collection("API integration")]
public class SetupEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task WithAnAdmin_SetupIsClosed_AndCannotCreateAnotherAdmin()
    {
        using var client = factory.CreateHttpsClient();   // not logged in
        var name = "sneaky" + Guid.NewGuid().ToString("N")[..10];

        var status = await client.GetFromJsonAsync<SetupStatusResponse>("/api/setup/status");
        var attempt = await client.PostAsJsonAsync("/api/setup/first-admin",
            new { username = name, email = name + "@example.org", password = "Password123" });

        Assert.False(status!.NeedsFirstAdmin);
        Assert.Equal(HttpStatusCode.Conflict, attempt.StatusCode);
        await using var db = factory.CreateDbContext();
        Assert.False(await db.Accounts.AnyAsync(a => a.Username == name));
    }
}
