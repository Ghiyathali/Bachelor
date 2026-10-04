using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Controllers;

public record CreateFeedbackRequest(
    [Range(1, 5)] int Rating,
    [Range(1, 5)] int UsefulnessRating,
    [Range(1, 5)] int InclusionRating,
    [MaxLength(2000)] string? WhatWorkedWell,
    [MaxLength(2000)] string? WhatCouldBeImproved,
    [MaxLength(2000)] string? Comment);

public record FeedbackResponse(
    int Id,
    int EventId,
    string EventName,
    int Rating,
    int? UsefulnessRating,
    int? InclusionRating,
    string? WhatWorkedWell,
    string? WhatCouldBeImproved,
    string? Comment,
    DateTimeOffset CreatedAt);

public record DashboardFeedbackResponse(
    int Id,
    int EventId,
    string EventName,
    int Rating,
    int? UsefulnessRating,
    int? InclusionRating,
    string? WhatWorkedWell,
    string? WhatCouldBeImproved,
    string? Comment,
    DateTimeOffset CreatedAt);

public record FeedbackDashboardResponse(
    int TotalResponses,
    double? AverageRating,
    double? AverageUsefulnessRating,
    double? AverageInclusionRating,
    IReadOnlyDictionary<int, int> RatingCounts,
    IReadOnlyDictionary<int, int> UsefulnessRatingCounts,
    IReadOnlyDictionary<int, int> InclusionRatingCounts,
    IReadOnlyList<DashboardFeedbackResponse> Responses);

[ApiController]
[Route("api/events/{eventId:int}/feedback")]
public class FeedbackController(AppDbContext db) : ControllerBase
{
    [HttpPost]
    [EnableRateLimiting("feedback")] // max 20 submissions per minute per IP (see Program.cs)
    public async Task<ActionResult<FeedbackResponse>> Create(
        int eventId,
        CreateFeedbackRequest request)
    {
        var eventItem = await db.Events.SingleOrDefaultAsync(item => item.Id == eventId);
        if (eventItem is null)
            return NotFound(new { message = "Event not found." });

        if (!eventItem.IsFeedbackOpen)
            return Conflict(new { message = "Feedback is not open for this event." });

        var feedback = new Feedback
        {
            EventId = eventId,
            Rating = request.Rating,
            UsefulnessRating = request.UsefulnessRating,
            InclusionRating = request.InclusionRating,
            WhatWorkedWell = CleanComment(request.WhatWorkedWell),
            WhatCouldBeImproved = CleanComment(request.WhatCouldBeImproved),
            Comment = CleanComment(request.Comment),
        };

        db.Feedback.Add(feedback);
        await db.SaveChangesAsync();

        var response = ToResponse(feedback, eventItem.Name);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    private static FeedbackResponse ToResponse(Feedback feedback, string eventName) => new(
        feedback.Id,
        feedback.EventId,
        eventName,
        feedback.Rating,
        feedback.UsefulnessRating,
        feedback.InclusionRating,
        feedback.WhatWorkedWell,
        feedback.WhatCouldBeImproved,
        feedback.Comment,
        feedback.CreatedAt);

    private static string? CleanComment(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

[ApiController]
[Route("api/feedback/dashboard")]
[Authorize(Roles = "Admin,Event Manager")]
public class FeedbackDashboardController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<FeedbackDashboardResponse>> Get([FromQuery] int? eventId)
    {
        if (eventId.HasValue && !await db.Events.AnyAsync(item => item.Id == eventId.Value))
            return NotFound(new { message = "Event not found." });

        var query = db.Feedback.AsNoTracking().AsQueryable();
        if (eventId.HasValue)
            query = query.Where(item => item.EventId == eventId.Value);

        var responses = await query
            .OrderByDescending(item => item.CreatedAt)
            .Select(item => new DashboardFeedbackResponse(
                item.Id,
                item.EventId,
                item.Event.Name,
                item.Rating,
                item.UsefulnessRating,
                item.InclusionRating,
                item.WhatWorkedWell,
                item.WhatCouldBeImproved,
                item.Comment,
                item.CreatedAt))
            .ToListAsync();

        var ratingCounts = Enumerable.Range(1, 5)
            .ToDictionary(rating => rating, rating => responses.Count(item => item.Rating == rating));
        var usefulnessRatingCounts = Enumerable.Range(1, 5)
            .ToDictionary(rating => rating, rating => responses.Count(item => item.UsefulnessRating == rating));
        var inclusionRatingCounts = Enumerable.Range(1, 5)
            .ToDictionary(rating => rating, rating => responses.Count(item => item.InclusionRating == rating));
        var usefulnessRatings = responses
            .Where(item => item.UsefulnessRating.HasValue)
            .Select(item => item.UsefulnessRating!.Value)
            .ToList();
        var inclusionRatings = responses
            .Where(item => item.InclusionRating.HasValue)
            .Select(item => item.InclusionRating!.Value)
            .ToList();

        return Ok(new FeedbackDashboardResponse(
            responses.Count,
            responses.Count == 0 ? null : responses.Average(item => item.Rating),
            usefulnessRatings.Count == 0 ? null : usefulnessRatings.Average(),
            inclusionRatings.Count == 0 ? null : inclusionRatings.Average(),
            ratingCounts,
            usefulnessRatingCounts,
            inclusionRatingCounts,
            responses));
    }
}
