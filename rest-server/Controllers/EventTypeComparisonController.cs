using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Controllers;

public record EventTypeComparison(int? EventTypeId, string Name, int EventCount,
    double? AverageSatisfaction, int? Participants);
public record EventTypeComparisonResponse(IReadOnlyList<EventTypeComparison> Types);

[ApiController]
[Route("api/dashboard/event-types")]
[Authorize(Roles = "Admin,Event Manager")]
public class EventTypeComparisonController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<EventTypeComparisonResponse>> Get(
        [FromQuery] DateOnly? from = null, [FromQuery] DateOnly? to = null,
        CancellationToken cancellationToken = default)
    {
        if (from > to || from is { Year: < 2 or > 9998 } || to is { Year: < 2 or > 9998 })
            return BadRequest(new { message = "Use an ordered date range between years 2 and 9998." });

        var events = db.Events.AsNoTracking().AsQueryable();
        if (from.HasValue)
        {
            var start = new DateTimeOffset(from.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
            events = events.Where(e => e.StartsAt >= start);
        }
        if (to.HasValue)
        {
            var end = new DateTimeOffset(to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
            events = events.Where(e => e.StartsAt < end);
        }

        // Aggregate separately so feedback and registrations cannot multiply each other.
        // Null types form one Uncategorised group; unused types are not included.
        var counts = await events.GroupBy(e => new { e.EventTypeId, Name = e.EventType == null ? "Uncategorised" : e.EventType.Name })
            .Select(g => new { g.Key.EventTypeId, g.Key.Name, Count = g.Count() })
            .ToListAsync(cancellationToken);
        var feedback = await db.Feedback.Where(f => events.Any(e => e.Id == f.EventId))
            .GroupBy(f => f.Event.EventTypeId)
            .Select(g => new { TypeId = g.Key, Count = g.Count(), Average = g.Average(f => (double)f.Rating) })
            .ToListAsync(cancellationToken);
        var participants = await db.EventRegistrations
            .Where(r => r.Status == RegistrationStatus.Accepted && events.Any(e => e.Id == r.EventId))
            .GroupBy(r => r.Event.EventTypeId)
            .Select(g => new { TypeId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        // Each measure has its own threshold. Never send small counts or their averages
        // to the browser, including the feedback denominator used for suppression.
        var types = counts.OrderBy(g => g.Name).Select(g =>
        {
            var ratings = feedback.SingleOrDefault(f => f.TypeId == g.EventTypeId);
            var accepted = participants.SingleOrDefault(p => p.TypeId == g.EventTypeId)?.Count ?? 0;
            return new EventTypeComparison(g.EventTypeId, g.Name, g.Count,
                ratings is { Count: >= 5 } ? ratings.Average : null,
                accepted >= 5 ? accepted : null);
        }).ToList();
        return Ok(new EventTypeComparisonResponse(types));
    }
}
