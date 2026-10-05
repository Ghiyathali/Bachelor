using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestServer.Data;

namespace RestServer.Controllers;

public record FeedbackStatsResponse(int ResponsesThisMonth, int MonthlyGoal);

// FR-13: public aggregate for the "community progress" message on the feedback page.
// Returns ONE total count - never individual responses or anything per person/device.
[ApiController]
[Route("api/feedback/stats")]
public class FeedbackStatsController(AppDbContext db, IConfiguration config) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<FeedbackStatsResponse>> Get()
    {
        // First day of the current month, 00:00 UTC
        var now = DateTimeOffset.UtcNow;
        var monthStart = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);

        var count = await db.Feedback.CountAsync(feedback => feedback.CreatedAt >= monthStart);

        // Can be set in appsettings.json as "Gamification": { "MonthlyGoal": 500 }
        var goal = config.GetValue("Gamification:MonthlyGoal", 500);

        return Ok(new FeedbackStatsResponse(count, goal));
    }
}
