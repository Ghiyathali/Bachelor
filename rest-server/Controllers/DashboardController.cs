using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Controllers;

public record RatingBucket(int Rating, int Count);
public record SatisfactionDistributionResponse(int TotalResponses, IReadOnlyList<RatingBucket> Ratings);

// Per event: everyone who signed up, and how many of them got a spot (Accepted).
public record EventAttendance(
    int EventId,
    string EventName,
    DateTimeOffset StartsAt,
    int SignedUpCount,
    int AcceptedCount);

public record AttendanceByEventResponse(IReadOnlyList<EventAttendance> Events);

// FR-04: the key metrics shown as tiles at the top of the dashboard.
// AverageSatisfaction and AcceptanceRate are null when there is no data to average.
public record OverviewResponse(
    int TotalEvents,
    int TotalParticipants,
    double? AverageSatisfaction,
    int FeedbackResponses,
    double? AcceptanceRate);

[ApiController]
[Route("api/dashboard")]
[Authorize(Roles = "Admin,Event Manager")]
public class DashboardController(AppDbContext db) : ControllerBase
{
    [HttpGet("overview")]
    public async Task<ActionResult<OverviewResponse>> GetOverview()
    {
        // Every number is counted or averaged in the database (COUNT / AVG in SQL),
        // so no individual feedback or registration rows leave the database.
        var totalEvents = await db.Events.CountAsync();
        var feedbackResponses = await db.Feedback.CountAsync();
        var averageRating = await db.Feedback.AverageAsync(item => (double?)item.Rating);

        // Participants = sign-ups with status Accepted (got a spot at the event).
        // Pangaea's sign-up data has no "attended" status, so Accepted is the closest measure.
        var accepted = await db.EventRegistrations
            .CountAsync(registration => registration.Status == RegistrationStatus.Accepted);
        var signedUp = await db.EventRegistrations.CountAsync();

        return Ok(new OverviewResponse(
            totalEvents,
            accepted,
            averageRating is null ? null : Math.Round(averageRating.Value, 1),
            feedbackResponses,
            signedUp == 0 ? null : Math.Round(100.0 * accepted / signedUp, 1)));
    }

    [HttpGet("satisfaction")]
    public async Task<ActionResult<SatisfactionDistributionResponse>> GetSatisfaction(
        [FromQuery] int? eventId)
    {
        if (eventId.HasValue && !await db.Events.AnyAsync(item => item.Id == eventId.Value))
            return NotFound(new { message = "Event not found." });

        var query = db.Feedback.AsNoTracking().AsQueryable();
        if (eventId.HasValue)
            query = query.Where(item => item.EventId == eventId.Value);

        // The grouping is translated to SQL. Only five aggregate rows can leave the database.
        var counts = await query
            .GroupBy(item => item.Rating)
            .Select(group => new { Rating = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.Rating, item => item.Count);

        var ratings = Enumerable.Range(1, 5)
            .Select(rating => new RatingBucket(rating, counts.GetValueOrDefault(rating)))
            .ToList();

        return Ok(new SatisfactionDistributionResponse(ratings.Sum(item => item.Count), ratings));
    }

    [HttpGet("attendance")]
    public async Task<ActionResult<AttendanceByEventResponse>> GetAttendance(
        [FromQuery, Range(1, 50)] int limit = 10)
    {
        // Select the most recent events, but return them chronologically for the chart.
        // SignedUp = every sign-up for the event; Accepted = the ones who got a spot.
        var events = await db.Events
            .AsNoTracking()
            .OrderByDescending(eventItem => eventItem.StartsAt)
            .Take(limit)
            .Select(eventItem => new EventAttendance(
                eventItem.Id,
                eventItem.Name,
                eventItem.StartsAt,
                eventItem.Registrations.Count(),
                eventItem.Registrations.Count(registration =>
                    registration.Status == RegistrationStatus.Accepted)))
            .ToListAsync();

        events.Reverse();
        return Ok(new AttendanceByEventResponse(events));
    }
}
