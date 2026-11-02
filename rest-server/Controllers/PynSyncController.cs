using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestServer.Data;
using RestServer.Models;
using RestServer.Sync;

namespace RestServer.Controllers;

// What an Admin sees after a sync: when, whether it worked, and the counts. No personal data.
public record PynSyncRunResponse(
    int Id, string TriggeredBy, DateTimeOffset StartedAt, DateTimeOffset? FinishedAt, bool Succeeded,
    int EventsRead, int EventsInserted, int EventsUpdated, int EventsSkipped, int EventTypesCreated,
    int RegistrationsRead, int RegistrationsInserted, int RegistrationsUpdated,
    int RegistrationsEventNotFound, int RegistrationsEventAmbiguous, int RegistrationsUnknownStatus,
    string? Error);

// #69: run the PYN sync now, and see the last run. Admin only.
[ApiController]
[Route("api/admin/pyn-sync")]
[Authorize(Roles = "Admin")]
public class PynSyncController(PynSyncService sync, AppDbContext db) : ControllerBase
{
    // POST /api/admin/pyn-sync - "Sync now".
    // 200 with the report (check Succeeded), 409 if a sync is already running,
    // 503 if ConnectionStrings__PynSource is not set.
    [HttpPost]
    public async Task<ActionResult<PynSyncRunResponse>> RunNow(CancellationToken cancellationToken)
    {
        if (!sync.IsConfigured)
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { message = "PYN sync is not configured." });

        var run = await sync.RunAsync("manual", cancellationToken);
        if (run is null)
            return Conflict(new { message = "A PYN sync is already running. Try again in a moment." });

        return Ok(ToResponse(run));
    }

    // GET /api/admin/pyn-sync/last - when did the last sync run, and what did it do?
    [HttpGet("last")]
    public async Task<ActionResult<PynSyncRunResponse>> GetLast(CancellationToken cancellationToken)
    {
        var run = await db.PynSyncRuns
            .AsNoTracking()
            .OrderByDescending(item => item.StartedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return run is null
            ? NotFound(new { message = "No PYN sync has run yet." })
            : Ok(ToResponse(run));
    }

    private static PynSyncRunResponse ToResponse(PynSyncRun run) => new(
        run.Id, run.TriggeredBy, run.StartedAt, run.FinishedAt, run.Succeeded,
        run.EventsRead, run.EventsInserted, run.EventsUpdated, run.EventsSkipped, run.EventTypesCreated,
        run.RegistrationsRead, run.RegistrationsInserted, run.RegistrationsUpdated,
        run.RegistrationsEventNotFound, run.RegistrationsEventAmbiguous, run.RegistrationsUnknownStatus,
        run.Error);
}
