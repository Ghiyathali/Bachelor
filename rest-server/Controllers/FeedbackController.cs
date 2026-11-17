using Microsoft.AspNetCore.Authorization;
using RestServer.Auth;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Controllers;

// FR-01: what the feedback form sends. The three 1-5 ratings are required, the three comment
// boxes are optional. No name, email or device id is ever part of the request (NFR-02).
public record CreateFeedbackRequest(
    [Range(1, 5)] int Rating,
    [Range(1, 5)] int UsefulnessRating,
    [Range(1, 5)] int InclusionRating,
    [MaxLength(2000)] string? WhatWorkedWell,
    [MaxLength(2000)] string? WhatCouldBeImproved,
    [MaxLength(2000)] string? Comment);

// Sent back after a successful submit; the feedback form uses it for the thank-you screen
// and the reward points (FR-13).
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

// FR-01: the endpoint the feedback form posts to. Participants have no account, so it is
// open without login ([AllowAnonymous]) and protected by a rate limit instead (#42).
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
        // Only an existing event with feedback open can receive feedback.
        var eventItem = await db.Events.SingleOrDefaultAsync(item => item.Id == eventId);
        if (eventItem is null)
            return NotFound(new { message = "Event not found." });

        if (!eventItem.IsFeedbackOpen)
            return Conflict(new { message = "Feedback is not open for this event." });

        // CreatedAt is set by the model. Nothing about the sender (IP, device) is stored.
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

    // Copies the stored row into the response record, so the database model is never sent directly.
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

    // Empty or whitespace-only comments are stored as null, so "no comment" is always the same value.
    private static string? CleanComment(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
