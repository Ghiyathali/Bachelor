using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using RestServer.Data;
using Testcontainers.PostgreSql;

namespace RestServer.Tests;

// Like a brand-new customer database (for example PYN's): no tables and no accounts.
// Always a throwaway PostgreSQL in Docker, never a configured or shared database,
// and the app itself has to create the tables when it starts.
public class EmptyDatabaseFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _database = new PostgreSqlBuilder("postgres:17-alpine").Build();
    private readonly Dictionary<string, string?> _previous = new();

    private static readonly string[] Settings =
        ["ConnectionStrings__Postgres", "Jwt__Key", "ConnectionStrings__PynSource", "PynSync__ViewSchema"];

    public async Task InitializeAsync()
    {
        await _database.StartAsync();
        // Program.cs reads these when it starts. The old values are put back afterwards,
        // so the other test classes keep using their own database.
        foreach (var name in Settings) _previous[name] = Environment.GetEnvironmentVariable(name);
        Environment.SetEnvironmentVariable("ConnectionStrings__Postgres", _database.GetConnectionString());
        Environment.SetEnvironmentVariable("Jwt__Key", "test-only-signing-key-that-is-at-least-32-bytes");
        Environment.SetEnvironmentVariable("ConnectionStrings__PynSource", null);
        Environment.SetEnvironmentVariable("PynSync__ViewSchema", null);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseEnvironment("Testing");

    public HttpClient CreateHttpsClient() =>
        CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

    public AppDbContext CreateDbContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(_database.GetConnectionString()).Options);

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        foreach (var (name, value) in _previous) Environment.SetEnvironmentVariable(name, value);
        await _database.DisposeAsync();
    }
}
