using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using RestServer.Auth;
using RestServer.Data;

namespace RestServer.Tests;

// The first Admin in a new (production) database: `dotnet run --project rest-server -- create-admin`.
[Collection("API integration")]
public class CreateAdminTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Password = "FirstAdmin1";
    private const string ShownConnection = "Host=testhost;Database=testdb;Username=x;Password=secret-db-password";

    private static string Unique(string name) => name + Guid.NewGuid().ToString("N")[..10];

    // Runs the command with typed answers, like a person in the terminal.
    private async Task<(int ExitCode, string Output)> RunCommand(params string[] answers)
    {
        await using var db = factory.CreateDbContext();
        var output = new StringWriter();
        var exitCode = await CreateAdminCommand.RunAsync(db, ShownConnection, new StringReader(string.Join("\n", answers) + "\n"), output);
        return (exitCode, output.ToString());
    }

    private async Task<HttpStatusCode> LoginStatus(string identifier, string password)
    {
        using var client = factory.CreateHttpsClient();
        return (await client.PostAsJsonAsync("/api/auth/login", new { identifier, password })).StatusCode;
    }

    [Fact]
    public async Task Command_CreatesAnAdmin_WhoCanLogIn_AndManageAccounts()
    {
        var name = Unique("Jurgita");

        var (exitCode, output) = await RunCommand(name, name + "@pangaeayouth.org", Password, Password, "y");

        Assert.Equal(0, exitCode);
        Assert.Contains("Created Admin account", output);
        // Stored in lowercase, and login works with any casing (FR-15).
        await using var db = factory.CreateDbContext();
        var account = await db.Accounts.Include(a => a.Role).SingleAsync(a => a.Username == name.ToLowerInvariant());
        Assert.Equal(RoleNames.Admin, account.Role.Name);
        Assert.NotEqual(Password, account.PasswordHash);   // only the bcrypt hash is stored
        Assert.Equal(HttpStatusCode.OK, await LoginStatus(name, Password));
        using var admin = await factory.CreateLoggedInClientAsync(name, Password);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/admin/accounts")).StatusCode);
    }

    [Fact]
    public async Task Command_ShowsTheDatabase_ButNeverThePassword()
    {
        var name = Unique("shown");

        var (_, output) = await RunCommand(name, name + "@test.example", Password, Password, "n");

        Assert.Contains("testdb on testhost", output);
        Assert.DoesNotContain("secret-db-password", output);
        Assert.DoesNotContain(Password, output);
    }

    [Fact]
    public async Task Command_Cancelled_CreatesNothing()
    {
        var name = Unique("cancel");

        var (exitCode, output) = await RunCommand(name, name + "@test.example", Password, Password, "n");

        Assert.Equal(1, exitCode);
        Assert.Contains("Cancelled", output);
        await using var db = factory.CreateDbContext();
        Assert.False(await db.Accounts.AnyAsync(a => a.Username == name));
    }

    [Fact]
    public async Task Command_PasswordsDoNotMatch_CreatesNothing()
    {
        var name = Unique("mismatch");

        var (exitCode, output) = await RunCommand(name, name + "@test.example", Password, "Different1", "y");

        Assert.Equal(1, exitCode);
        Assert.Contains("do not match", output);
        await using var db = factory.CreateDbContext();
        Assert.False(await db.Accounts.AnyAsync(a => a.Username == name));
    }

    [Theory]
    [InlineData("ab", "ok@test.example", "LongEnough1", "username")]                 // too short
    [InlineData("has space", "ok@test.example", "LongEnough1", "username")]
    [InlineData("has@at", "ok@test.example", "LongEnough1", "username")]
    [InlineData("validname", "not-an-email", "LongEnough1", "email")]
    [InlineData("validname", "ok@test.example", "short7c", "password")]             // 7 characters
    public async Task InvalidDetails_AreRejected_AndNothingIsCreated(string username, string email, string password, string field)
    {
        await using var db = factory.CreateDbContext();
        var before = await db.Accounts.CountAsync();

        var result = await AdminAccounts.CreateAsync(db, username, email, password);

        Assert.False(result.Created);
        Assert.Contains(field, result.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(before, await db.Accounts.CountAsync());
    }

    [Fact]
    public async Task TakenUsernameOrEmail_IsRejected_IgnoringCase()
    {
        var name = Unique("taken");
        await using var db = factory.CreateDbContext();
        Assert.True((await AdminAccounts.CreateAsync(db, name, name + "@test.example", Password)).Created);

        var sameName = await AdminAccounts.CreateAsync(db, name.ToUpperInvariant(), Unique("other") + "@test.example", Password);
        var sameEmail = await AdminAccounts.CreateAsync(db, Unique("other"), (name + "@TEST.example").ToUpperInvariant(), Password);

        Assert.False(sameName.Created);
        Assert.Contains("already taken", sameName.Message);
        Assert.False(sameEmail.Created);
        Assert.Contains("already registered", sameEmail.Message);
        // The first password still works: nothing was overwritten.
        Assert.Equal(HttpStatusCode.OK, await LoginStatus(name, Password));
    }
}
