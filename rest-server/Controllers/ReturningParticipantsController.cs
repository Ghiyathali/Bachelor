using RestServer.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestServer.Dashboard;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Controllers;

// FR-09: share of participants who said they had joined a Pangaea event before.
// Self-reported on the sign-up form ("attended_before"), not tracked by us.
public record ReturningByEventType(int? EventTypeId, string Name, double? ReturningPercent);
public record ReturningParticipantsResponse(
    int? Answered,
    double? ReturningPercent,
    IReadOnlyList<ReturningByEventType> ByEventType);

[ApiController]
[Route("api/dashboard/returning")]
[Authorize(Roles = RoleNames.Analytics)]
public class ReturningParticipantsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ReturningParticipantsResponse>> Get(
        [FromQuery] DashboardFilter filter, CancellationToken cancellationToken = default)
    {
        if (filter.Validate() is { } error)
            return BadRequest(new { message = error });

        // Only Accepted sign-ups (people who got a spot), and only people who answered
        // the question - an empty answer is neither "yes" nor "no".
        var events = filter.ApplyToEvents(db.Events.AsNoTracking());
        var groups = await filter.ApplyToSignUps(db.EventRegistrations, events)
            .Where(r => r.Status == RegistrationStatus.Accepted && r.AttendedBefore != null)
            .GroupBy(r => new { r.Event.EventTypeId, Name = r.Event.EventType == null ? "Uncategorised" : r.Event.EventType.Name })
            .Select(g => new
            {
                g.Key.EventTypeId,
                g.Key.Name,
                Answered = g.Count(),
                Returning = g.Count(r => r.AttendedBefore == true),
            })
            .ToListAsync(cancellationToken);

        // NFR-02: a percentage is only shown when at least 5 people answered.
        // Per type only the percentage is sent - sending each type's answer count would
        // let a hidden small group be worked out as "total minus the visible types".
        var answered = groups.Sum(g => g.Answered);
        var returning = groups.Sum(g => g.Returning);
        var byType = groups
            .OrderBy(g => g.Name)
            .Select(g => new ReturningByEventType(g.EventTypeId, g.Name, Percent(g.Returning, g.Answered)))
            .ToList();

        return Ok(new ReturningParticipantsResponse(
            DashboardFilter.Suppress(answered),
            Percent(returning, answered),
            byType));
    }

    private static double? Percent(int returning, int answered) =>
        answered >= DashboardFilter.MinGroupSize ? Math.Round(100.0 * returning / answered, 1) : null;
}
