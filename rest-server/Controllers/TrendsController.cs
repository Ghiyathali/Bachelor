using RestServer.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestServer.Dashboard;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Controllers;

// #25 / NFR-02: FeedbackResponses, AverageSatisfaction and Participants are null when a
// period covers fewer than 5 people.
public record TrendPoint(DateOnly PeriodStart, int EventCount, int? FeedbackResponses,
    double? AverageSatisfaction, int? Participants);
public record TrendsResponse(string Interval, IReadOnlyList<TrendPoint> Periods);

[ApiController]
[Route("api/dashboard/trends")]
[Authorize(Roles = RoleNames.Analytics)]
public class TrendsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<TrendsResponse>> Get(
        [FromQuery] string interval = "month", [FromQuery] int? eventId = null,
        [FromQuery] DateOnly? from = null, [FromQuery] DateOnly? to = null,
        [FromQuery] DashboardFilter? filter = null,
        CancellationToken cancellationToken = default)
    {
        // #25: the dashboard filter bar (event type, season, city, age band, gender).
        // The chart's own interval/event/from/to work exactly as before.
        filter ??= new DashboardFilter();
        if (interval is not ("month" or "season"))
            return BadRequest(new { message = "Interval must be month or season." });
        if (from > to || from is { Year: < 2 or > 9998 } || to is { Year: < 2 or > 9998 })
            return BadRequest(new { message = "Use an ordered date range between years 2 and 9998." });
        if (eventId.HasValue && !await db.Events.AnyAsync(e => e.Id == eventId, cancellationToken))
            return NotFound(new { message = "Event not found." });

        var events = db.Events.AsNoTracking().AsQueryable();
        if (eventId.HasValue) events = events.Where(e => e.Id == eventId);
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
        events = filter.ApplyToEvents(events);

        // Separate SQL aggregates avoid multiplying feedback by registrations when joining.
        // UTC event dates are used even when feedback/sign-ups arrive in a later month.
        var eventMonths = await events
            .GroupBy(e => new { e.StartsAt.UtcDateTime.Year, e.StartsAt.UtcDateTime.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count(), WalkIns = g.Sum(e => e.WalkIns) })
            .ToListAsync(cancellationToken);
        var feedbackMonths = await db.Feedback.Where(f => events.Any(e => e.Id == f.EventId))
            .GroupBy(f => new { f.Event.StartsAt.UtcDateTime.Year, f.Event.StartsAt.UtcDateTime.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count(), Sum = g.Sum(f => (long)f.Rating) })
            .ToListAsync(cancellationToken);
        var participantMonths = await filter.ApplyToSignUps(db.EventRegistrations, events)
            .Where(r => r.Status == RegistrationStatus.Accepted)
            .GroupBy(r => new { r.Event.StartsAt.UtcDateTime.Year, r.Event.StartsAt.UtcDateTime.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count() })
            .ToListAsync(cancellationToken);

        DateOnly Period(int year, int month)
        {
            var date = new DateOnly(year, month, 1);
            return interval == "month" ? date : date.AddMonths(-(month % 3));
        }

        var eventCounts = eventMonths.GroupBy(m => Period(m.Year, m.Month))
            .ToDictionary(g => g.Key, g => g.Sum(m => m.Count));
        var feedback = feedbackMonths.GroupBy(m => Period(m.Year, m.Month))
            .ToDictionary(g => g.Key, g => (Count: g.Sum(m => m.Count), Sum: g.Sum(m => m.Sum)));
        var participants = participantMonths.GroupBy(m => Period(m.Year, m.Month))
            .ToDictionary(g => g.Key, g => g.Sum(m => m.Count));
        // Walk-ins count as participants too, unless a city/age/gender filter is used (they have none).
        var walkIns = filter.IncludesWalkIns
            ? eventMonths.GroupBy(m => Period(m.Year, m.Month)).ToDictionary(g => g.Key, g => g.Sum(m => m.WalkIns))
            : [];
        var first = from.HasValue ? Period(from.Value.Year, from.Value.Month)
            : eventCounts.Count > 0 ? eventCounts.Keys.Min() : (DateOnly?)null;
        var last = to.HasValue ? Period(to.Value.Year, to.Value.Month)
            : eventCounts.Count > 0 ? eventCounts.Keys.Max() : (DateOnly?)null;

        if (first is null || last is null) return Ok(new TrendsResponse(interval, []));
        if ((last.Value.Year - first.Value.Year) * 12 + last.Value.Month - first.Value.Month > 1200)
            return BadRequest(new { message = "Choose a date range of 100 years or less." });

        var points = new List<TrendPoint>();
        for (var date = first.Value; date <= last.Value; date = date.AddMonths(interval == "month" ? 1 : 3))
        {
            var count = eventCounts.GetValueOrDefault(date);
            var ratings = feedback.GetValueOrDefault(date);
            // NFR-02: hide a period's feedback and participants when they cover fewer than 5 people.
            var enoughFeedback = ratings.Count >= DashboardFilter.MinGroupSize;
            points.Add(new TrendPoint(date, count, DashboardFilter.Suppress(ratings.Count),
                enoughFeedback ? (double)ratings.Sum / ratings.Count : null,
                count == 0 ? null : DashboardFilter.Suppress(participants.GetValueOrDefault(date) + walkIns.GetValueOrDefault(date))));
        }
        return Ok(new TrendsResponse(interval, points));
    }
}
