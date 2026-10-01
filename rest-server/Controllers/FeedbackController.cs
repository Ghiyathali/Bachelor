using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Controllers;

public record CreateFeedbackRequest(
    [Range(1, 5)] int Rating,
    [MaxLength(2000)] string? Comment);

public record FeedbackResponse(
    int Id,
    int EventId,
    string EventName,
    int Rating,
    string? Comment,
    DateTimeOffset CreatedAt);

public record DashboardFeedbackResponse(
    int Id,
    int EventId,
    string EventName,
    int AccountId,
    string Username,
    int Rating,
    string? Comment,
    DateTimeOffset CreatedAt);

public record FeedbackDashboardResponse(
    int TotalResponses,
    double? AverageRating,
    IReadOnlyDictionary<int, int> RatingCounts,
    IReadOnlyList<DashboardFeedbackResponse> Responses);

[ApiController]
[Route("api/events/{eventId:int}/feedback")]
[Authorize]
public class FeedbackController(AppDbContext db) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<FeedbackResponse>> Create(
        int eventId,
        CreateFeedbackRequest request)
    {
        if (!TryGetAccountId(out var accountId))
            return Unauthorized();

        var eventItem = await db.Events.SingleOrDefaultAsync(item => item.Id == eventId);
        if (eventItem is null)
            return NotFound(new { message = "Event not found." });

        if (!eventItem.IsFeedbackOpen)
            return Conflict(new { message = "Feedback is not open for this event." });

        if (await db.Feedback.AnyAsync(item => item.EventId == eventId && item.AccountId == accountId))
            return Conflict(new { message = "You have already submitted feedback for this event." });

        var feedback = new Feedback
        {
            EventId = eventId,
            AccountId = accountId,
            Rating = request.Rating,
            Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim(),
        };

        db.Feedback.Add(feedback);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException exception) when (
            exception.InnerException is PostgresException
            {
                SqlState: PostgresErrorCodes.UniqueViolation,
            })
        {
            return Conflict(new { message = "You have already submitted feedback for this event." });
        }

        var response = ToResponse(feedback, eventItem.Name);
        return CreatedAtAction(nameof(GetMine), new { eventId }, response);
    }

    [HttpGet("mine")]
    public async Task<ActionResult<FeedbackResponse>> GetMine(int eventId)
    {
        if (!TryGetAccountId(out var accountId))
            return Unauthorized();

        var feedback = await db.Feedback
            .AsNoTracking()
            .Where(item => item.EventId == eventId && item.AccountId == accountId)
            .Select(item => new FeedbackResponse(
                item.Id,
                item.EventId,
                item.Event.Name,
                item.Rating,
                item.Comment,
                item.CreatedAt))
            .SingleOrDefaultAsync();

        return feedback is null ? NotFound() : Ok(feedback);
    }

    private bool TryGetAccountId(out int accountId) =>
        int.TryParse(User.FindFirstValue("sub"), out accountId);

    private static FeedbackResponse ToResponse(Feedback feedback, string eventName) => new(
        feedback.Id,
        feedback.EventId,
        eventName,
        feedback.Rating,
        feedback.Comment,
        feedback.CreatedAt);
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
                item.AccountId,
                item.Account.Username,
                item.Rating,
                item.Comment,
                item.CreatedAt))
            .ToListAsync();

        var ratingCounts = Enumerable.Range(1, 5)
            .ToDictionary(rating => rating, rating => responses.Count(item => item.Rating == rating));

        return Ok(new FeedbackDashboardResponse(
            responses.Count,
            responses.Count == 0 ? null : responses.Average(item => item.Rating),
            ratingCounts,
            responses));
    }
}
