using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using RestServer.Data;
using Testcontainers.PostgreSql;

namespace RestServer.Tests;

// Starts the real REST server in memory for the tests, backed by a throwaway
// PostgreSQL database in Docker. The database is created before the first test
// and deleted after the last one, so the shared Azure database is never touched.
public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    // Same PostgreSQL version as the team's docker-compose.yml.
    private readonly PostgreSqlContainer _database = new PostgreSqlBuilder("postgres:17-alpine").Build();

    public async Task InitializeAsync()
    {
        await _database.StartAsync();

        // Program.cs reads these settings when it starts, so they are set as
        // environment variables (the same names as in rest-server/.env).
        Environment.SetEnvironmentVariable("ConnectionStrings__Postgres", _database.GetConnectionString());
        Environment.SetEnvironmentVariable("Jwt__Key", "test-only-signing-key-that-is-at-least-32-bytes");

        // Create the tables with the team's real EF Core migrations.
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_database.GetConnectionString())
            .Options;
        await using var db = new AppDbContext(options);
        await db.Database.MigrateAsync();
    }

    // "Testing" instead of "Development": no dev seeding of admins or demo data.
    protected override void ConfigureWebHost(IWebHostBuilder builder) =>
        builder.UseEnvironment("Testing");

    // HTTPS base address, because Program.cs redirects plain HTTP to HTTPS (NFR-01).
    public HttpClient CreateHttpsClient() =>
        CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        await _database.DisposeAsync();
    }
}
