using RestServer.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestServer.Dashboard;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Controllers;

// FR-14 / #82: estimated attendance for a planned event of a given type.
public record AttendanceEstimateResponse(
    int EventTypeId,
    string EventTypeName,
    DateOnly Date,
    int BasedOnEvents,
    double? Average,
    int? Estimate,
    int? Low,
    int? High);

[ApiController]
[Route("api/dashboard/estimate")]
[Authorize(Roles = RoleNames.Analytics)]
public class AttendanceEstimateController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<AttendanceEstimateResponse>> Get(
        [FromQuery] int? eventTypeId, [FromQuery] DateOnly? date, CancellationToken cancellationToken = default)
    {
        if (eventTypeId is null || date is null)
            return BadRequest(new { message = "Choose an event type and a planned date." });
        if (date is { Year: < 2 or > 9998 })
            return BadRequest(new { message = "Use a date between years 2 and 9998." });

        var type = await db.EventTypes.AsNoTracking()
            .Where(t => t.Id == eventTypeId)
            .Select(t => new { t.Id, t.Name })
            .SingleOrDefaultAsync(cancellationToken);
        if (type is null)
            return NotFound(new { message = "Event type not found." });

        // Past events of this type, one number each: how many got a spot (Accepted) + walk-ins.
        // Events without any sign-up or walk-in are left out - that means "no data", not "nobody came".
        var now = DateTimeOffset.UtcNow;
        var past = await db.Events.AsNoTracking()
            .Where(e => e.EventTypeId == type.Id && e.StartsAt < now && (e.Registrations.Any() || e.WalkIns > 0))
            .Select(e => new PastEvent(e.StartsAt, e.Registrations.Count(r => r.Status == RegistrationStatus.Accepted) + e.WalkIns))
            .ToListAsync(cancellationToken);

        var planned = new DateTimeOffset(date.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
        var estimate = AttendanceEstimator.Estimate(past, planned);

        return Ok(new AttendanceEstimateResponse(type.Id, type.Name, date.Value,
            estimate.BasedOnEvents, estimate.Average, estimate.Estimate, estimate.Low, estimate.High));
    }
}
