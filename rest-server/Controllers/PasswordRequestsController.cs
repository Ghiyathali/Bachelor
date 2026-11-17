using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RestServer.Auth;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Controllers;

public record ForgotPasswordRequest(
    [Required] string Identifier,                            // username or email
    [Required, MinLength(8), MaxLength(72)] string NewPassword);
public record PasswordRequestResponse(int Id, int AccountId, string Username, string Email, DateTimeOffset RequestedAt);

// "Forgot password?": anyone can ASK for a new password, but only an Admin can approve it.
// Without the approval step, anyone who knows a colleague's email could take over their account.
[ApiController]
public class PasswordRequestsController(AppDbContext db) : ControllerBase
{
    // Old requests are not kept forever: after a day the person has to ask again.
    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(24);

    public const string SentMessage = "Request sent. An administrator has to approve it before you can log in with your new password.";

    [HttpPost("api/auth/forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting("password-reset")]   // a few requests per minute per IP (Program.cs)
    public async Task<IActionResult> RequestReset(ForgotPasswordRequest request)
    {
        // Hash first, for every request: the answer takes as long whether the account exists or not.
        var hash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword, workFactor: 12);
        var identifier = request.Identifier.Trim().ToLowerInvariant();
        var account = await db.Accounts.SingleOrDefaultAsync(a =>
            a.IsActive && (a.Username.ToLower() == identifier || a.Email.ToLower() == identifier));

        if (account is not null)
        {
            var existing = await db.PasswordResetRequests.SingleOrDefaultAsync(r => r.AccountId == account.Id);
            if (existing is null)
                db.PasswordResetRequests.Add(new PasswordResetRequest { AccountId = account.Id, NewPasswordHash = hash });
            else
            {
                existing.NewPasswordHash = hash;   // a new request replaces the old one
                existing.CreatedAt = DateTimeOffset.UtcNow;
            }
            await db.SaveChangesAsync();
        }

        // Same answer whether the account exists or not, so the form can't be used to find accounts.
        return Accepted(new { message = SentMessage });
    }

    // The Admin's notification bell.
    [HttpGet("api/admin/password-requests")]
    [Authorize(Roles = RoleNames.Admin)]
    public async Task<ActionResult<IEnumerable<PasswordRequestResponse>>> List()
    {
        await RemoveExpired();
        return Ok(await db.PasswordResetRequests.AsNoTracking()
            .OrderBy(r => r.CreatedAt)
            .Select(r => new PasswordRequestResponse(r.Id, r.AccountId, r.Account.Username, r.Account.Email, r.CreatedAt))
            .ToListAsync());
    }

    [HttpPost("api/admin/password-requests/{id:int}/approve")]
    [Authorize(Roles = RoleNames.Admin)]
    public async Task<IActionResult> Approve(int id)
    {
        await RemoveExpired();
        var request = await db.PasswordResetRequests.Include(r => r.Account).SingleOrDefaultAsync(r => r.Id == id);
        if (request is null)
            return NotFound(new { message = "This request no longer exists or has expired." });

        // The new password applies now, and older logins of that account stop working.
        request.Account.PasswordHash = request.NewPasswordHash;
        request.Account.PasswordChangedAt = DateTimeOffset.UtcNow;
        db.PasswordResetRequests.Remove(request);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("api/admin/password-requests/{id:int}/decline")]
    [Authorize(Roles = RoleNames.Admin)]
    public async Task<IActionResult> Decline(int id)
    {
        var request = await db.PasswordResetRequests.SingleOrDefaultAsync(r => r.Id == id);
        if (request is null)
            return NotFound(new { message = "This request no longer exists or has expired." });
        db.PasswordResetRequests.Remove(request);   // nothing changes for the account
        await db.SaveChangesAsync();
        return NoContent();
    }

    private async Task RemoveExpired()
    {
        var cutoff = DateTimeOffset.UtcNow - Lifetime;
        await db.PasswordResetRequests.Where(r => r.CreatedAt < cutoff).ExecuteDeleteAsync();
    }
}
