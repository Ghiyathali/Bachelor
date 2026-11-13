using RestServer.Auth;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestServer.Dashboard;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Controllers;

// #25 / NFR-02: every count or average about people is null when it covers fewer than
// 5 people ("not enough data"), so small groups never leave the server.
public record RatingBucket(int Rating, int? Count);
public record SatisfactionDistributionResponse(int? TotalResponses, IReadOnlyList<RatingBucket> Ratings);

// Per event: everyone who signed up, and how many of them got a spot (Accepted).
public record EventAttendance(
    int EventId,
    string EventName,
    DateTimeOffset StartsAt,
    int? SignedUpCount,
    int? AcceptedCount,
    int? WalkInCount = null);   // null: no walk-ins, under 5, or a city/age/gender filter is used

public record AttendanceByEventResponse(IReadOnlyList<EventAttendance> Events);

// FR-04: the key metrics shown as tiles at the top of the dashboard.
public record OverviewResponse(
    int TotalEvents,
    int? TotalParticipants,
    double? AverageSatisfaction,
    int? FeedbackResponses,
    double? AcceptanceRate,
    int? WalkIns = null);   // the walk-ins included in TotalParticipants (null: none, under 5, or people filter)

// #25: the choices for the filter bar's dropdowns.
public record FilterOption(int Id, string Name);
public record FilterOptionsResponse(
    IReadOnlyList<FilterOption> Events,
    IReadOnlyList<FilterOption> EventTypes,
    IReadOnlyList<string> Cities,
    IReadOnlyList<string> Genders,
    IReadOnlyList<string> AgeBands,
    IReadOnlyList<string> Seasons);

[ApiController]
[Route("api/dashboard")]
[Authorize(Roles = RoleNames.Analytics)]
public class DashboardController(AppDbContext db) : ControllerBase
{
    [HttpGet("overview")]
    public async Task<ActionResult<OverviewResponse>> GetOverview([FromQuery] DashboardFilter filter)
    {
        if (filter.Validate() is { } error)
            return BadRequest(new { message = error });

        // Every number is counted or averaged in the database (COUNT / AVG in SQL),
        // so no individual feedback or registration rows leave the database.
        var events = filter.ApplyToEvents(db.Events.AsNoTracking());
        var totalEvents = await events.CountAsync();

        // Feedback follows the event filters only - it has no city, age or gender.
        var feedback = DashboardFilter.ApplyToFeedback(db.Feedback, events);
        var feedbackResponses = await feedback.CountAsync();
        var averageRating = await feedback.AverageAsync(item => (double?)item.Rating);

        // Participants = sign-ups with status Accepted (got a spot at the event) + walk-ins.
        // Pangaea's sign-up data has no "attended" status, so Accepted is the closest measure.
        var signUps = filter.ApplyToSignUps(db.EventRegistrations, events);
        var accepted = await signUps.CountAsync(registration => registration.Status == RegistrationStatus.Accepted);
        var signedUp = await signUps.CountAsync();
        var walkIns = filter.IncludesWalkIns ? await events.SumAsync(eventItem => eventItem.WalkIns) : 0;

        // NFR-02: hide every people-based number that covers fewer than 5 people.
        var enoughFeedback = feedbackResponses >= DashboardFilter.MinGroupSize;
        var enoughSignUps = signedUp >= DashboardFilter.MinGroupSize;
        // The acceptance rate stays sign-ups only: walk-ins never signed up, so they were never "accepted".
        var participants = DashboardFilter.Suppress(accepted + walkIns);
        return Ok(new OverviewResponse(
            totalEvents,
            participants,
            enoughFeedback ? Math.Round(averageRating!.Value, 1) : null,
            DashboardFilter.Suppress(feedbackResponses),
            enoughSignUps ? Math.Round(100.0 * accepted / signedUp, 1) : null,
            participants is null ? null : DashboardFilter.Suppress(walkIns)));
    }

    // #25: the dropdown choices for the filter bar. A city or gender is only offered when
    // at least 5 sign-ups have it - otherwise the list itself could point at one person.
    [HttpGet("filter-options")]
    public async Task<ActionResult<FilterOptionsResponse>> GetFilterOptions()
    {
        var events = await db.Events.AsNoTracking()
            .OrderByDescending(e => e.StartsAt)
            .Select(e => new FilterOption(e.Id, e.Name))
            .ToListAsync();
        var eventTypes = await db.EventTypes.AsNoTracking()
            .OrderBy(t => t.Name)
            .Select(t => new FilterOption(t.Id, t.Name))
            .ToListAsync();
        var cities = await db.EventRegistrations
            .Where(r => r.City != null)
            .GroupBy(r => r.City!)
            .Where(g => g.Count() >= DashboardFilter.MinGroupSize)
            .Select(g => g.Key)
            .OrderBy(city => city)
            .ToListAsync();
        var genders = await db.EventRegistrations
            .Where(r => r.Gender != null)
            .GroupBy(r => r.Gender!)
            .Where(g => g.Count() >= DashboardFilter.MinGroupSize)
            .Select(g => g.Key)
            .OrderBy(gender => gender)
            .ToListAsync();

        return Ok(new FilterOptionsResponse(
            events,
            eventTypes,
            cities,
            genders,
            Enum.GetNames<AgeBand>(),
            Enum.GetNames<Season>()));
    }

    [HttpGet("satisfaction")]
    public async Task<ActionResult<SatisfactionDistributionResponse>> GetSatisfaction(
        [FromQuery] DashboardFilter filter)
    {
        if (filter.Validate() is { } error)
            return BadRequest(new { message = error });
        if (filter.EventId.HasValue && !await db.Events.AnyAsync(item => item.Id == filter.EventId.Value))
            return NotFound(new { message = "Event not found." });

        // #25: event filters only - feedback has no city, age or gender.
        var events = filter.ApplyToEvents(db.Events.AsNoTracking());
        var query = DashboardFilter.ApplyToFeedback(db.Feedback.AsNoTracking(), events);

        // The grouping is translated to SQL. Only five aggregate rows can leave the database.
        var counts = await query
            .GroupBy(item => item.Rating)
            .Select(group => new { Rating = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.Rating, item => item.Count);
        var total = counts.Values.Sum();

        // NFR-02: each rating bucket is a group of people, so a bucket with fewer than
        // 5 responses is hidden - and everything is hidden when fewer than 5 answered.
        var ratings = Enumerable.Range(1, 5)
            .Select(rating => new RatingBucket(rating,
                total >= DashboardFilter.MinGroupSize ? DashboardFilter.Suppress(counts.GetValueOrDefault(rating)) : null))
            .ToList();

        return Ok(new SatisfactionDistributionResponse(DashboardFilter.Suppress(total), ratings));
    }

    [HttpGet("attendance")]
    public async Task<ActionResult<AttendanceByEventResponse>> GetAttendance(
        [FromQuery] DashboardFilter filter,
        [FromQuery, Range(1, 50)] int limit = 10)
    {
        if (filter.Validate() is { } error)
            return BadRequest(new { message = error });

        // Select the most recent events, but return them chronologically for the chart.
        var filteredEvents = filter.ApplyToEvents(db.Events.AsNoTracking());
        var events = await filteredEvents
            .OrderByDescending(eventItem => eventItem.StartsAt)
            .Take(limit)
            .Select(eventItem => new { eventItem.Id, eventItem.Name, eventItem.StartsAt, eventItem.WalkIns })
            .ToListAsync();

        // SignedUp = every sign-up for the event; Accepted = the ones who got a spot.
        // #25: sign-ups also follow the city, age band and gender filters.
        var eventIds = events.Select(e => e.Id).ToList();
        var counts = await filter.ApplyToSignUps(db.EventRegistrations, filteredEvents)
            .Where(registration => eventIds.Contains(registration.EventId))
            .GroupBy(registration => registration.EventId)
            .Select(group => new
            {
                EventId = group.Key,
                SignedUp = group.Count(),
                Accepted = group.Count(registration => registration.Status == RegistrationStatus.Accepted),
            })
            .ToDictionaryAsync(item => item.EventId);

        // NFR-02: a bar for fewer than 5 people is not shown.
        var result = events
            .Select(e =>
            {
                var count = counts.GetValueOrDefault(e.Id);
                return new EventAttendance(e.Id, e.Name, e.StartsAt,
                    DashboardFilter.Suppress(count?.SignedUp ?? 0),
                    DashboardFilter.Suppress(count?.Accepted ?? 0),
                    filter.IncludesWalkIns ? DashboardFilter.Suppress(e.WalkIns) : null);
            })
            .Reverse()
            .ToList();

        return Ok(new AttendanceByEventResponse(result));
    }
}
