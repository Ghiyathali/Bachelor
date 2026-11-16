using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestServer.Auth;
using RestServer.Data;
using Npgsql;

namespace RestServer.Controllers;

public record AccountResponse(int Id, string Username, string Email, string Role, bool IsActive);
public record UpdateAccountRequest(
    [Required] string Role,
    bool IsActive,
    [MinLength(3), MaxLength(30), RegularExpression(@"^[^@\s]+$", ErrorMessage = "Username cannot contain '@' or spaces.")]
    string? Username = null,
    [EmailAddress, MaxLength(256)] string? Email = null);

// New password: same rules as when an account is created (FR-14). CurrentPassword is only
// needed when Admins change their OWN password, so an unlocked computer is not enough.
public record ChangePasswordRequest(
    [Required, MinLength(8), MaxLength(72)] string NewPassword,   // bcrypt only uses the first 72 bytes
    string? CurrentPassword = null);

// Token is only filled in when you changed your own password: old logins stop working,
// so you get a new one and stay logged in.
public record ChangePasswordResponse(string? Token, DateTimeOffset? ExpiresAt);

[ApiController]
[Route("api/admin/accounts")]
[Authorize(Roles = RoleNames.Admin)]
public class AccountsController(AppDbContext db, TokenService tokens) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AccountResponse>>> List() => Ok(await db.Accounts
        .AsNoTracking().OrderBy(a => a.Username)
        .Select(a => new AccountResponse(a.Id, a.Username, a.Email, a.Role.Name, a.IsActive))
        .ToListAsync());

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AccountResponse>> Update(int id, UpdateAccountRequest request)
    {
        var account = await db.Accounts.Include(a => a.Role).SingleOrDefaultAsync(a => a.Id == id);
        if (account is null) return NotFound();
        var role = await db.Roles.SingleOrDefaultAsync(r => r.Name == request.Role);
        if (role is null) return BadRequest(new { message = "Unknown role." });
        // An administrator cannot accidentally remove their own administrative access.
        if (User.FindFirst("sub")?.Value == id.ToString() &&
            (!request.IsActive || request.Role != RoleNames.Admin))
            return Conflict(new { message = "Another administrator must change your administrative access." });

        var username = request.Username?.Trim().ToLowerInvariant() ?? account.Username;
        var email = request.Email?.Trim().ToLowerInvariant() ?? account.Email;
        if (await db.Accounts.AnyAsync(a => a.Id != id && a.Username.ToLower() == username))
            return Conflict(new { message = "This username is already taken." });
        if (await db.Accounts.AnyAsync(a => a.Id != id && a.Email.ToLower() == email))
            return Conflict(new { message = "This email is already registered." });

        account.Username = username;
        account.Email = email;
        account.Role = role;
        account.IsActive = request.IsActive;
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Conflict(new { message = "Email or username is already taken." });
        }
        return Ok(new AccountResponse(account.Id, account.Username, account.Email, role.Name, account.IsActive));
    }

    // Admin changes their own password, or resets the password of another account.
    [HttpPut("{id:int}/password")]
    public async Task<ActionResult<ChangePasswordResponse>> ChangePassword(int id, ChangePasswordRequest request)
    {
        var account = await db.Accounts.Include(a => a.Role).SingleOrDefaultAsync(a => a.Id == id);
        if (account is null) return NotFound();

        // 400, not 401: a wrong current password must not log the Admin out of the app.
        var self = User.FindFirst("sub")?.Value == id.ToString();
        if (self && (string.IsNullOrEmpty(request.CurrentPassword) ||
                     !BCrypt.Net.BCrypt.Verify(request.CurrentPassword, account.PasswordHash)))
            return BadRequest(new { message = "Current password is incorrect." });

        if (BCrypt.Net.BCrypt.Verify(request.NewPassword, account.PasswordHash))
            return BadRequest(new { message = "The new password must be different from the current one." });

        account.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword, workFactor: 12);
        account.PasswordChangedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();

        if (!self) return Ok(new ChangePasswordResponse(null, null));
        var (token, expiresAt) = tokens.CreateToken(account);
        return Ok(new ChangePasswordResponse(token, expiresAt));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (User.FindFirst("sub")?.Value == id.ToString())
            return Conflict(new { message = "Another administrator must delete your account." });
        var account = await db.Accounts.SingleOrDefaultAsync(a => a.Id == id);
        if (account is null) return NotFound();
        db.Accounts.Remove(account);
        await db.SaveChangesAsync();
        return NoContent();
    }

}
