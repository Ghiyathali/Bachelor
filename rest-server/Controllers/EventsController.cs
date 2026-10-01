using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Controllers;

public record EventResponse(
    int Id,
    string Name,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    string? Location,
    bool IsFeedbackOpen);

public record CreateEventRequest(
    [Required, MaxLength(200)] string Name,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    [MaxLength(300)] string? Location,
    bool IsFeedbackOpen = false);

public record SetFeedbackStatusRequest(bool IsFeedbackOpen);

[ApiController]
[Route("api/events")]
[Authorize]
public class EventsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<EventResponse>>> GetAll(
        [FromQuery] bool feedbackOpenOnly = true)
    {
        var query = db.Events.AsNoTracking();

        if (feedbackOpenOnly)
            query = query.Where(eventItem => eventItem.IsFeedbackOpen);

        return Ok(await query
            .OrderByDescending(eventItem => eventItem.StartsAt)
            .Select(eventItem => ToResponse(eventItem))
            .ToListAsync());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<EventResponse>> GetById(int id)
    {
        var eventItem = await db.Events.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id);
        return eventItem is null ? NotFound() : Ok(ToResponse(eventItem));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Event Manager")]
    public async Task<ActionResult<EventResponse>> Create(CreateEventRequest request)
    {
        var name = request.Name.Trim();
        if (name.Length == 0)
            return BadRequest(new { message = "Event name cannot be blank." });

        if (request.EndsAt <= request.StartsAt)
            return BadRequest(new { message = "Event end time must be after its start time." });

        var eventItem = new Event
        {
            Name = name,
            StartsAt = request.StartsAt,
            EndsAt = request.EndsAt,
            Location = string.IsNullOrWhiteSpace(request.Location) ? null : request.Location.Trim(),
            IsFeedbackOpen = request.IsFeedbackOpen,
        };

        db.Events.Add(eventItem);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = eventItem.Id }, ToResponse(eventItem));
    }

    [HttpPatch("{id:int}/feedback-status")]
    [Authorize(Roles = "Admin,Event Manager")]
    public async Task<ActionResult<EventResponse>> SetFeedbackStatus(
        int id,
        SetFeedbackStatusRequest request)
    {
        var eventItem = await db.Events.SingleOrDefaultAsync(item => item.Id == id);
        if (eventItem is null)
            return NotFound(new { message = "Event not found." });

        eventItem.IsFeedbackOpen = request.IsFeedbackOpen;
        await db.SaveChangesAsync();

        return Ok(ToResponse(eventItem));
    }

    private static EventResponse ToResponse(Event eventItem) => new(
        eventItem.Id,
        eventItem.Name,
        eventItem.StartsAt,
        eventItem.EndsAt,
        eventItem.Location,
        eventItem.IsFeedbackOpen);
}
