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

// Starts the real REST server in memory for the tests, backed by a throwaway
// PostgreSQL database in Docker. The database is created before the first test
// and deleted after the last one, so the shared Azure database is never touched.
public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    // The one Admin that exists in the test database (only creating accounts needs it).
    public const string AdminUsername = "testadmin";
    public const string AdminEmail = "testadmin@test.example";
    public const string AdminPassword = "AdminPassword1";

    // Same PostgreSQL version as the team's docker-compose.yml.
    private readonly PostgreSqlContainer _database = new PostgreSqlBuilder("postgres:17-alpine").Build();

    public async Task InitializeAsync()
    {
        await _database.StartAsync();

        // Program.cs reads these settings when it starts, so they are set as
        // environment variables (the same names as in rest-server/.env).
        Environment.SetEnvironmentVariable("ConnectionStrings__Postgres", _database.GetConnectionString());
        Environment.SetEnvironmentVariable("Jwt__Key", "test-only-signing-key-that-is-at-least-32-bytes");

        // #69: the PYN sync reads the mock PYN views in this same test database.
        Environment.SetEnvironmentVariable("ConnectionStrings__PynSource", _database.GetConnectionString());
        Environment.SetEnvironmentVariable("PynSync__ViewSchema", "pyn_mock_analytics");

        // Create the tables with the team's real EF Core migrations.
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_database.GetConnectionString())
            .Options;
        await using var db = new AppDbContext(options);
        await db.Database.MigrateAsync();

        // Only an Admin may create accounts (#52), so the test database needs one Admin
        // to start with - written directly to the database, like DevSeeder does in Development.
        // workFactor 4 = fastest bcrypt setting; fine for a throwaway test database.
        var adminRole = await db.Roles.SingleAsync(role => role.Name == "Admin");
        db.Accounts.Add(new Account
        {
            Username = AdminUsername,
            Email = AdminEmail,
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
        CreateLoggedInClientAsync(AdminUsername, AdminPassword);

    private record TokenBody(string Token);

    // #69: a fresh AppDbContext on the test database, to check what the API wrote.
    public AppDbContext CreateDbContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(_database.GetConnectionString()).Options);

    // #69: runs SQL on the test database - the mock PYN script, or a change "at PYN".
    public async Task ExecuteSqlAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(_database.GetConnectionString());
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
        await _database.DisposeAsync();
    }
}
