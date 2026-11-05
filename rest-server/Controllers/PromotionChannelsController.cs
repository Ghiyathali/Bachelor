using RestServer.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestServer.Dashboard;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Controllers;

// FR-10: how participants heard about Pangaea. Only grouped counts are sent - no total,
// so a hidden "Other" can't be worked out as "total minus the visible channels".
public record PromotionChannelsResponse(IReadOnlyList<ChannelCount> Channels);

[ApiController]
[Route("api/dashboard/channels")]
[Authorize(Roles = RoleNames.Analytics)]
public class PromotionChannelsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PromotionChannelsResponse>> Get(
        [FromQuery] DashboardFilter filter, CancellationToken cancellationToken = default)
    {
        if (filter.Validate() is { } error)
            return BadRequest(new { message = error });

        // Same people as #29: Accepted sign-ups that answered the question.
        var events = filter.ApplyToEvents(db.Events.AsNoTracking());
        var counts = await filter.ApplyToSignUps(db.EventRegistrations, events)
            .Where(r => r.Status == RegistrationStatus.Accepted && r.HeardAbout != null && r.HeardAbout != "")
            .GroupBy(r => r.HeardAbout!)
            .Select(g => new { Channel = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        // NFR-02: small channels are merged into "Other" (see PromotionChannelGrouping).
        var channels = PromotionChannelGrouping.Group(counts.Select(c => (c.Channel, c.Count)));
        return Ok(new PromotionChannelsResponse(channels));
    }
}
