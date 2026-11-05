using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestServer.Auth;
using RestServer.Data;

namespace RestServer.Controllers;

public record AccountResponse(int Id, string Username, string Email, string Role, bool IsActive);
public record UpdateAccountRequest([Required] string Role, bool IsActive);

[ApiController]
[Route("api/admin/accounts")]
[Authorize(Roles = RoleNames.Admin)]
public class AccountsController(AppDbContext db) : ControllerBase
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

        account.Role = role;
        account.IsActive = request.IsActive;
        await db.SaveChangesAsync();
        return Ok(new AccountResponse(account.Id, account.Username, account.Email, role.Name, account.IsActive));
    }
}
