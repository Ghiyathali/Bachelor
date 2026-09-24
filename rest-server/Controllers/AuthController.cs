using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db) : ControllerBase
{
    // Frederik's seeded role name. The requirements call it "Standard User" - align later.
    private const string DefaultRoleName = "User";

    // ---------- REGISTER ----------
    // POST /api/auth/register
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<RegisterResponse>> Register(RegisterRequest request)
    {
        // Store in lower-case so "Yami" and "yami" are the same account.
        var email = request.Email.Trim().ToLowerInvariant();
        var username = request.Username.Trim().ToLowerInvariant();

        if (await db.Accounts.AnyAsync(a => a.Email.ToLower() == email))
            return Conflict(new { message = "This email is already registered." });

        if (await db.Accounts.AnyAsync(a => a.Username.ToLower() == username))
            return Conflict(new { message = "This username is already taken." });

        // Every new account gets the lowest role. The user cannot choose it.
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
            // Two people registered the same name at the exact same moment:
            // the database's unique index stops the second one.
            return Conflict(new { message = "Email or username is already taken." });
        }

        // 201 Created. We never send the password or hash back.
        return StatusCode(StatusCodes.Status201Created,
            new RegisterResponse(account.Id, account.Username, account.Email, defaultRole.Name));
    }

    // ---------- PROTECTED TEST ----------
    // GET /api/auth/me - only works with a valid token.
    // (login is added in the next commit)
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
