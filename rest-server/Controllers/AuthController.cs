using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestServer.Auth;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Controllers;

// ---------- Data sent to / returned from the API ----------

// POST /api/auth/register body. The attributes are the validation rules (FR-14).
// If a rule fails, [ApiController] automatically answers 400 Bad Request.
public record RegisterRequest(
    [Required, EmailAddress, MaxLength(256)]
    string Email,

    [Required, MinLength(3), MaxLength(30)]
    [RegularExpression(@"^[^@\s]+$", ErrorMessage = "Username cannot contain '@' or spaces.")]
    string Username,

    [Required, MinLength(8), MaxLength(72)]   // bcrypt only uses the first 72 bytes
    string Password);

public record RegisterResponse(int Id, string Username, string Email, string Role);

// POST /api/auth/login body. "Identifier" = username OR email (FR-15).
public record LoginRequest([Required] string Identifier, [Required] string Password);

public record LoginResponse(string Token, DateTimeOffset ExpiresAt, string Username, string Email, string Role);

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, TokenService tokens) : ControllerBase
{
    // The lowest of the four roles in FR-12 (seeded in AppDbContext.cs).
    private const string DefaultRoleName = "Standard User";

    // A real bcrypt hash of a random value. Used when the account does not exist,
    // so "unknown user" takes as long as "wrong password" - attackers can't tell them apart by timing.
    private static readonly string DummyHash =
        BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString(), workFactor: 12);

    // ---------- CREATE ACCOUNT (Admin only) ----------
    // POST /api/auth/register
    // Only a logged-in Admin may create accounts (#52). The app is for PYN staff only,
    // and the API is reachable from the internet, so self-registration would let
    // anyone create an account. No token -> 401, token without the Admin role -> 403.
    [HttpPost("register")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<RegisterResponse>> Register(RegisterRequest request)
    {
        // Store in lower-case so "Yami" and "yami" are the same account.
        var email = request.Email.Trim().ToLowerInvariant();
        var username = request.Username.Trim().ToLowerInvariant();

        if (await db.Accounts.AnyAsync(a => a.Email.ToLower() == email))
            return Conflict(new { message = "This email is already registered." });

        if (await db.Accounts.AnyAsync(a => a.Username.ToLower() == username))
            return Conflict(new { message = "This username is already taken." });

        // Every new account gets the lowest role. Choosing a role is part of #32.
        var defaultRole = await db.Roles.SingleAsync(r => r.Name == DefaultRoleName);

        var account = new Account
        {
            Email = email,
            Username = username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, workFactor: 12),
            RoleId = defaultRole.Id,
        };

        db.Accounts.Add(account);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Two accounts with the same name created at the exact same moment:
            // the database's unique index stops the second one.
            return Conflict(new { message = "Email or username is already taken." });
        }

        // 201 Created. We never send the password or hash back.
        return StatusCode(StatusCodes.Status201Created,
            new RegisterResponse(account.Id, account.Username, account.Email, defaultRole.Name));
    }

    // ---------- LOGIN ----------
    // POST /api/auth/login
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var identifier = request.Identifier.Trim().ToLowerInvariant();
        var isEmail = identifier.Contains('@');   // usernames can't contain '@', so this is safe

        var query = db.Accounts.AsNoTracking().Include(a => a.Role);
        var account = isEmail
            ? await query.SingleOrDefaultAsync(a => a.Email.ToLower() == identifier)
            : await query.SingleOrDefaultAsync(a => a.Username.ToLower() == identifier);

        var passwordOk = BCrypt.Net.BCrypt.Verify(request.Password, account?.PasswordHash ?? DummyHash);

        // Same answer for "no such user" and "wrong password" - never reveal which one.
        if (account is null || !passwordOk)
            return Unauthorized(new { message = "Invalid username/email or password." });

        var (token, expiresAt) = tokens.CreateToken(account);
        return Ok(new LoginResponse(token, expiresAt, account.Username, account.Email, account.Role.Name));
    }

    // ---------- PROTECTED TEST ----------
    // GET /api/auth/me - only works with a valid token.
    [HttpGet("me")]
    [Authorize]
    public IActionResult Me() => Ok(new
    {
        id = User.FindFirst("sub")?.Value,
        username = User.FindFirst("username")?.Value,
        email = User.FindFirst("email")?.Value,
        role = User.FindFirst("role")?.Value,
    });
}
