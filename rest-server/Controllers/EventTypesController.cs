using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Controllers;

public record EventTypeResponse(int Id, string Name);

// POST and PUT body: the type's name.
public record SaveEventTypeRequest([Required, MaxLength(100)] string Name);

// #53: event categories (e.g. Workshop, Sports) for the type filter (FR-05) and the
// type comparison (FR-08). Stored as data, so PYN can change them without a developer.
// Any logged-in user may read the list; only Admin and Event Manager may change it.
[ApiController]
[Route("api/event-types")]
[Authorize]
public class EventTypesController(AppDbContext db) : ControllerBase
{
    private const string ManagerRoles = "Admin,Event Manager";

    // GET /api/event-types
    [HttpGet]
    public async Task<ActionResult<IEnumerable<EventTypeResponse>>> GetAll() =>
        Ok(await db.EventTypes
            .AsNoTracking()
            .OrderBy(eventType => eventType.Name)
            .Select(eventType => new EventTypeResponse(eventType.Id, eventType.Name))
            .ToListAsync());

    // POST /api/event-types
    [HttpPost]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<EventTypeResponse>> Create(SaveEventTypeRequest request)
    {
        var name = request.Name.Trim();
        if (name.Length == 0)
            return BadRequest(new { message = "Event type name cannot be blank." });

        if (await NameTakenAsync(name, exceptId: null))
            return Conflict(new { message = "An event type with this name already exists." });

        var eventType = new EventType { Name = name };
        db.EventTypes.Add(eventType);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Same name created at the exact same moment: the unique index stops the second one.
            return Conflict(new { message = "An event type with this name already exists." });
        }

        return StatusCode(StatusCodes.Status201Created, new EventTypeResponse(eventType.Id, eventType.Name));
    }

    // PUT /api/event-types/{id} - rename, e.g. replace a placeholder with PYN's real name.
    [HttpPut("{id:int}")]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<EventTypeResponse>> Rename(int id, SaveEventTypeRequest request)
    {
        var eventType = await db.EventTypes.SingleOrDefaultAsync(item => item.Id == id);
        if (eventType is null)
            return NotFound(new { message = "Event type not found." });

        var name = request.Name.Trim();
        if (name.Length == 0)
            return BadRequest(new { message = "Event type name cannot be blank." });

        if (await NameTakenAsync(name, exceptId: id))
            return Conflict(new { message = "An event type with this name already exists." });

        eventType.Name = name;
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "An event type with this name already exists." });
        }

        return Ok(new EventTypeResponse(eventType.Id, eventType.Name));
    }

    // DELETE /api/event-types/{id} - its events are kept and become "no type" (ON DELETE SET NULL).
    [HttpDelete("{id:int}")]
    [Authorize(Roles = ManagerRoles)]
    public async Task<IActionResult> Delete(int id)
    {
        var eventType = await db.EventTypes.SingleOrDefaultAsync(item => item.Id == id);
        if (eventType is null)
            return NotFound(new { message = "Event type not found." });

        db.EventTypes.Remove(eventType);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // Case-insensitive, so "Workshop" and "workshop" can't both exist.
    private Task<bool> NameTakenAsync(string name, int? exceptId)
    {
        var lower = name.ToLowerInvariant();
        return db.EventTypes.AnyAsync(eventType =>
            eventType.Name.ToLower() == lower && (exceptId == null || eventType.Id != exceptId.Value));
    }
}
