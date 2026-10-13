using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Controllers;

public record RatingBucket(int Rating, int Count);
public record SatisfactionDistributionResponse(int TotalResponses, IReadOnlyList<RatingBucket> Ratings);

public record EventAttendance(
    int EventId,
    string EventName,
    DateTimeOffset StartsAt,
    int RegisteredCount,
    int AttendedCount);

public record AttendanceByEventResponse(IReadOnlyList<EventAttendance> Events);

[ApiController]
[Route("api/dashboard")]
[Authorize(Roles = "Admin,Event Manager")]
public class DashboardController(AppDbContext db) : ControllerBase
{
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
        // Registered is the non-cancelled population; attended is its checked-in subset.
        var events = await db.Events
            .AsNoTracking()
            .OrderByDescending(eventItem => eventItem.StartsAt)
            .Take(limit)
            .Select(eventItem => new EventAttendance(
                eventItem.Id,
                eventItem.Name,
                eventItem.StartsAt,
                eventItem.Registrations.Count(registration =>
                    registration.Status != RegistrationStatus.Cancelled),
                eventItem.Registrations.Count(registration =>
                    registration.Status == RegistrationStatus.Attended)))
            .ToListAsync();

        events.Reverse();
        return Ok(new AttendanceByEventResponse(events));
    }
}
