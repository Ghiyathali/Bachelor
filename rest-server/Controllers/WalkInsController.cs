using RestServer.Auth;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestServer.Data;

namespace RestServer.Controllers;

public record EventWalkIns(int EventId, string Name, DateTimeOffset StartsAt, int WalkIns);

// 10 000 is far above any real event, so a typo like 40000 is rejected instead of saved.
public record SetWalkInsRequest([Range(0, 10_000)] int WalkIns);

// Walk-ins: staff enter how many people came without signing up, as one number per event.
// Only Admin and Event Manager, the same roles that manage events.
[ApiController]
[Route("api/events")]
[Authorize(Roles = RoleNames.EventManagement)]
public class WalkInsController(AppDbContext db) : ControllerBase
{
    // Every event with its walk-in number, newest first, for the Events page.
    [HttpGet("walk-ins")]
    public async Task<ActionResult<IReadOnlyList<EventWalkIns>>> GetAll() =>
        Ok(await db.Events.AsNoTracking()
            .OrderByDescending(eventItem => eventItem.StartsAt)
            .Select(eventItem => new EventWalkIns(eventItem.Id, eventItem.Name, eventItem.StartsAt, eventItem.WalkIns))
            .ToListAsync());

    [HttpPatch("{id:int}/walk-ins")]
    public async Task<ActionResult<EventWalkIns>> Set(int id, SetWalkInsRequest request)
    {
        var eventItem = await db.Events.SingleOrDefaultAsync(item => item.Id == id);
        if (eventItem is null)
            return NotFound(new { message = "Event not found." });

        // Walk-ins are only known once the event has started.
        if (eventItem.StartsAt > DateTimeOffset.UtcNow)
            return BadRequest(new { message = "Walk-ins can only be added once the event has started." });

        eventItem.WalkIns = request.WalkIns;
        await db.SaveChangesAsync();
        return Ok(new EventWalkIns(eventItem.Id, eventItem.Name, eventItem.StartsAt, eventItem.WalkIns));
    }
}
