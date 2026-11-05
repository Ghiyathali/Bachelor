using Microsoft.AspNetCore.Authorization;
using RestServer.Auth;
using System.ComponentModel.DataAnnotations;
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

[ApiController]
[Route("api/events/{eventId:int}/feedback")]
public class FeedbackController(AppDbContext db) : ControllerBase
{
    [AllowAnonymous]
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
