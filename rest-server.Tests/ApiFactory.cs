using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using RestServer.Data;
using RestServer.Models;
using Testcontainers.PostgreSql;

namespace RestServer.Tests;

// Uses the configured Azure test database directly. CI falls back to Docker when
// no connection is configured. Tests never create or drop an Azure database.
public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    // Unique per fixture so repeated runs against the same database cannot collide.
    private readonly string _adminUsername = "testadmin" + Guid.NewGuid().ToString("N")[..12];
    private const string AdminPassword = "AdminPassword1";

    // Capture once, before fixtures set process-wide connection settings for the API.
    private static readonly string? ConfiguredConnectionString = LoadConfiguredConnectionString();
    private string ConnectionString => ConfiguredConnectionString ?? _database!.GetConnectionString();
    private PostgreSqlContainer? _database;

    private static string? LoadConfiguredConnectionString()
    {
        var configured = Environment.GetEnvironmentVariable("ConnectionStrings__Postgres");
        if (!string.IsNullOrWhiteSpace(configured)) return configured;

        // Locate rest-server/.env regardless of the directory dotnet test was run from.
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            var envFile = Path.Combine(directory.FullName, "rest-server", ".env");
            if (!File.Exists(envFile)) continue;
            return DotNetEnv.Env.NoEnvVars().Load(envFile)
                .FirstOrDefault(pair => pair.Key == "ConnectionStrings__Postgres").Value;
        }
        return null;
    }

    public async Task InitializeAsync()
    {
        if (string.IsNullOrWhiteSpace(ConfiguredConnectionString))
        {
            _database = new PostgreSqlBuilder("postgres:17-alpine").Build();
            await _database.StartAsync();
        }

        // Program.cs reads these settings when it starts, so they are set as
        // environment variables (the same names as in rest-server/.env).
        Environment.SetEnvironmentVariable("ConnectionStrings__Postgres", ConnectionString);
        Environment.SetEnvironmentVariable("Jwt__Key", "test-only-signing-key-that-is-at-least-32-bytes");

        // #69: the PYN sync reads the mock PYN views in this same test database.
        Environment.SetEnvironmentVariable("ConnectionStrings__PynSource", ConnectionString);
        Environment.SetEnvironmentVariable("PynSync__ViewSchema", "pyn_mock_analytics");

        // Create the tables with the team's real EF Core migrations.
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;
        await using var db = new AppDbContext(options);
        await db.Database.MigrateAsync();

        // Only an Admin may create accounts (#52), so the test database needs one Admin
        // to start with - written directly to the database, like DevSeeder does in Development.
        // workFactor 4 keeps integration-test setup fast.
        var adminRole = await db.Roles.SingleAsync(role => role.Name == "Admin");
        db.Accounts.Add(new Account
        {
            Username = _adminUsername,
            Email = _adminUsername + "@test.example",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(AdminPassword, workFactor: 4),
            RoleId = adminRole.Id,
        });
        await db.SaveChangesAsync();
    }

    // "Testing" instead of "Development": no dev seeding of admins or demo data.
    protected override void ConfigureWebHost(IWebHostBuilder builder) =>
        builder.UseEnvironment("Testing");

    // HTTPS base address, because Program.cs redirects plain HTTP to HTTPS (NFR-01).
    public HttpClient CreateHttpsClient() =>
        CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

    // Logs in and returns a client that sends "Authorization: Bearer <token>" on every request.
    public async Task<HttpClient> CreateLoggedInClientAsync(string identifier, string password)
    {
        var client = CreateHttpsClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new { identifier, password });
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<TokenBody>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.Token);
        return client;
    }

    public Task<HttpClient> CreateAdminClientAsync() =>
        CreateLoggedInClientAsync(_adminUsername, AdminPassword);

    private record TokenBody(string Token);

    // #69: a fresh AppDbContext on the test database, to check what the API wrote.
    public AppDbContext CreateDbContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(ConnectionString).Options);

    // #69: runs SQL on the test database - the mock PYN script, or a change "at PYN".
    public async Task ExecuteSqlAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    // #69: creates the mock PYN database (rest-server/Data/PynMock/pyn_mock.sql).
    public async Task CreatePynMockAsync() =>
        await ExecuteSqlAsync(await File.ReadAllTextAsync(
            Path.Combine(AppContext.BaseDirectory, "PynMock", "pyn_mock.sql")));

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        if (_database is not null) await _database.DisposeAsync();
    }
}
