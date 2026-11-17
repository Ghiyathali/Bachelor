using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestServer.Auth;
using RestServer.Data;

namespace RestServer.Controllers;

public record SetupStatusResponse(bool NeedsFirstAdmin);
public record FirstAdminRequest(string? Username, string? Email, string? Password);

// First start on a new database (for example PYN's own): there is no Admin yet, so nobody could
// log in or create accounts. The login page then shows "Create the first admin account" instead.
// Both endpoints are open without login, but creating only works while NO Admin exists:
// after that it is refused forever, so nobody can use it later to make themselves Admin.
[ApiController]
[Route("api/setup")]
[AllowAnonymous]
public class SetupController(AppDbContext db, TokenService tokens) : ControllerBase
{
    // Any number that is unique to this lock; Postgres uses it to let only one request in at a time.
    private const long FirstAdminLock = 4_207_311;

    [HttpGet("status")]
    public async Task<SetupStatusResponse> GetStatus() => new(!await AdminExists());

    [HttpPost("first-admin")]
    public async Task<ActionResult<LoginResponse>> CreateFirstAdmin(FirstAdminRequest request)
    {
        // The lock makes two people pressing "Create" at the same moment wait for each other,
        // so the second one sees the first Admin and is refused.
        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock({0})", FirstAdminLock);

        if (await AdminExists())
            return Conflict(new { message = "An administrator already exists. Log in instead." });

        // Same rules as everywhere else (FR-14): username, email and an 8 to 72 character password.
        var result = await AdminAccounts.CreateAsync(db, request.Username, request.Email, request.Password);
        if (!result.Created)
            return BadRequest(new { message = result.Message });
        await transaction.CommitAsync();

        // Log the new Admin straight in, like a normal login (FR-15).
        var account = result.Account!;
        await db.Entry(account).Reference(a => a.Role).LoadAsync();
        var (token, expiresAt) = tokens.CreateToken(account);
        return Ok(new LoginResponse(token, expiresAt, account.Username, account.Email, account.Role.Name));
    }

    private Task<bool> AdminExists() => db.Accounts.AnyAsync(a => a.Role.Name == RoleNames.Admin);
}
