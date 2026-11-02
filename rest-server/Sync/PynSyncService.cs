using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Sync;

// #69: copies PYN's events and sign-ups into our tables (design document, section 7).
//   1. read PYN's two views (read-only - we never write to PYN),
//   2. clean every value with PynMapping,
//   3. insert or update our rows by ExternalId, all in ONE transaction,
//   4. store a PynSyncRun with the counts (numbers only, no personal data).
public class PynSyncService(AppDbContext db, PynSyncOptions options, ILogger<PynSyncService> logger)
{
    // Only one sync at a time - two at once would try to insert the same rows.
    private static readonly SemaphoreSlim OneRunAtATime = new(1, 1);

    // Schema names can't be sent as SQL parameters, so only plain names are allowed.
    private static readonly Regex SafeSchemaName = new("^[a-z_][a-z0-9_]*$");

    public bool IsConfigured => options.IsConfigured;

    // Returns null if another sync is already running.
    public async Task<PynSyncRun?> RunAsync(string triggeredBy, CancellationToken cancellationToken = default)
    {
        if (!await OneRunAtATime.WaitAsync(0, cancellationToken))
            return null;

        try
        {
            return await RunOnceAsync(triggeredBy, cancellationToken);
        }
        finally
        {
            OneRunAtATime.Release();
        }
    }

    private async Task<PynSyncRun> RunOnceAsync(string triggeredBy, CancellationToken cancellationToken)
    {
        var run = new PynSyncRun { TriggeredBy = triggeredBy, StartedAt = DateTimeOffset.UtcNow };

        try
        {
            if (!options.IsConfigured)
                throw new InvalidOperationException("PYN sync is not configured (ConnectionStrings__PynSource).");
            if (!SafeSchemaName.IsMatch(options.ViewSchema))
                throw new InvalidOperationException("PynSync__ViewSchema is not a valid schema name.");

            // 1. Read from PYN first, so their database is only used for a short moment.
            var pynEvents = await ReadEventsAsync(cancellationToken);
            var pynRegistrations = await ReadRegistrationsAsync(cancellationToken);

            // 2 + 3. Write into our tables - all or nothing.
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            await SyncEventsAsync(pynEvents, run, cancellationToken);
            await SyncRegistrationsAsync(pynRegistrations, run, cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            run.Succeeded = true;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // The transaction was rolled back, so nothing was written - the counts must say so too.
            db.ChangeTracker.Clear();
            run.EventsInserted = run.EventsUpdated = run.EventTypesCreated = 0;
            run.RegistrationsInserted = run.RegistrationsUpdated = 0;
            run.Error = Truncate($"{exception.GetType().Name}: {exception.Message}", 1000);
            logger.LogError(exception, "PYN sync failed.");
        }

        // 4. Remember the run (also when it failed, so Admins can see why).
        run.FinishedAt = DateTimeOffset.UtcNow;
        db.PynSyncRuns.Add(run);
        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "PYN sync ({TriggeredBy}) succeeded={Succeeded}: events +{EventsInserted}/~{EventsUpdated}, sign-ups +{RegistrationsInserted}/~{RegistrationsUpdated}.",
            run.TriggeredBy, run.Succeeded, run.EventsInserted, run.EventsUpdated, run.RegistrationsInserted, run.RegistrationsUpdated);
        return run;
    }

    // ---------- 1. Reading PYN's views ----------

    private record PynEventRow(Guid Id, string? Title, string? City, string? StartDate, string? FinishDate, string? Topic);

    private record PynRegistrationRow(
        long Id, string? EventName, DateOnly? EventDate, string? Status, DateTimeOffset SubmittedAt,
        string? AgeBand, string? City, string? Nationality, string? Gender, string? HeardAbout,
        bool? AttendedBefore, bool? FewerOpportunities);

    private async Task<List<PynEventRow>> ReadEventsAsync(CancellationToken cancellationToken)
    {
        // The view already contains only published and archived events (design, Appendix A).
        var sql = $"""
            SELECT id, title, city, start_date, finish_date, topic
            FROM "{options.ViewSchema}".events
            """;

        var rows = new List<PynEventRow>();
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            rows.Add(new PynEventRow(
                reader.GetGuid(0), Text(reader, 1), Text(reader, 2), Text(reader, 3), Text(reader, 4), Text(reader, 5)));
        }
        return rows;
    }

    private async Task<List<PynRegistrationRow>> ReadRegistrationsAsync(CancellationToken cancellationToken)
    {
        var sql = $"""
            SELECT id, event_name, event_date, status, submitted_at, age_band,
                   city, nationality, gender, heard_about, attended_before, fewer_opportunities
            FROM "{options.ViewSchema}".event_registrations
            """;

        var rows = new List<PynRegistrationRow>();
        await using var connection = new NpgsqlConnection(options.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            rows.Add(new PynRegistrationRow(
                reader.GetInt64(0),
                Text(reader, 1),
                reader.IsDBNull(2) ? null : reader.GetFieldValue<DateOnly>(2),
                Text(reader, 3),
                reader.GetFieldValue<DateTimeOffset>(4),
                Text(reader, 5),
                Text(reader, 6),
                Text(reader, 7),
                Text(reader, 8),
                Text(reader, 9),
                reader.IsDBNull(10) ? null : reader.GetBoolean(10),
                reader.IsDBNull(11) ? null : reader.GetBoolean(11)));
        }
        return rows;
    }

    private static string? Text(NpgsqlDataReader reader, int column) =>
        reader.IsDBNull(column) ? null : reader.GetString(column);

    // ---------- 2 + 3. Writing into our tables ----------

    private async Task SyncEventsAsync(List<PynEventRow> rows, PynSyncRun run, CancellationToken cancellationToken)
    {
        run.EventsRead = rows.Count;

        var existing = await db.Events
            .Where(eventItem => eventItem.ExternalId != null)
            .ToDictionaryAsync(eventItem => eventItem.ExternalId!.Value, cancellationToken);
        var eventTypes = await db.EventTypes.ToListAsync(cancellationToken);

        foreach (var row in rows)
        {
            var name = PynMapping.CleanName(row.Title, 200);
            var startsAt = PynMapping.ParseEventDate(row.StartDate);
            if (name is null || startsAt is null)
            {
                run.EventsSkipped++;   // no title, or a date we can't read - never guessed
                continue;
            }

            var endsAt = PynMapping.ParseEventDate(row.FinishDate) ?? startsAt.Value;
            if (endsAt < startsAt.Value)
                endsAt = startsAt.Value;

            var isNew = !existing.TryGetValue(row.Id, out var eventItem);
            if (isNew)
            {
                // New events start with feedback closed; staff open it in our app.
                eventItem = new Event { Name = name, ExternalId = row.Id, IsFeedbackOpen = false };
                db.Events.Add(eventItem);
                existing[row.Id] = eventItem;
            }

            // IsFeedbackOpen is OUR setting and is never overwritten by the sync.
            eventItem!.Name = name;
            eventItem.StartsAt = startsAt.Value;
            eventItem.EndsAt = endsAt;
            eventItem.Location = PynMapping.CleanName(row.City, 300);
            eventItem.EventType = FindOrCreateEventType(eventTypes, row.Topic, run);

            if (isNew)
                run.EventsInserted++;
            else if (db.Entry(eventItem).State == EntityState.Modified)
                run.EventsUpdated++;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    // PYN's topic becomes our event type: matched by name ignoring letter case ("workshop" = "Workshop"),
    // created when it's new ("Language café").
    private EventType? FindOrCreateEventType(List<EventType> eventTypes, string? topic, PynSyncRun run)
    {
        var name = PynMapping.CleanName(topic, 100);
        if (name is null)
            return null;

        var key = PynMapping.MatchKey(name);
        var existing = eventTypes.FirstOrDefault(eventType => PynMapping.MatchKey(eventType.Name) == key);
        if (existing is not null)
            return existing;

        var created = new EventType { Name = name };
        db.EventTypes.Add(created);
        eventTypes.Add(created);
        run.EventTypesCreated++;
        return created;
    }

    private async Task SyncRegistrationsAsync(
        List<PynRegistrationRow> rows, PynSyncRun run, CancellationToken cancellationToken)
    {
        run.RegistrationsRead = rows.Count;

        // Only events that came from PYN can be matched - never one created by hand in our app.
        var candidates = await db.Events
            .Where(eventItem => eventItem.ExternalId != null)
            .Select(eventItem => new PynMapping.EventCandidate(eventItem.Id, eventItem.Name, eventItem.StartsAt))
            .ToListAsync(cancellationToken);
        var existing = await db.EventRegistrations
            .Where(registration => registration.ExternalId != null)
            .ToDictionaryAsync(registration => registration.ExternalId!.Value, cancellationToken);

        foreach (var row in rows)
        {
            var status = PynMapping.ParseStatus(row.Status);
            if (status is null)
            {
                run.RegistrationsUnknownStatus++;
                continue;
            }

            var match = PynMapping.MatchEvent(candidates, row.EventName, row.EventDate);
            if (match.Outcome == PynMapping.MatchOutcome.NotFound)
            {
                run.RegistrationsEventNotFound++;
                continue;
            }
            if (match.Outcome == PynMapping.MatchOutcome.Ambiguous)
            {
                run.RegistrationsEventAmbiguous++;
                continue;
            }

            var isNew = !existing.TryGetValue(row.Id, out var registration);
            if (isNew)
            {
                registration = new EventRegistration { ExternalId = row.Id };
                db.EventRegistrations.Add(registration);
                existing[row.Id] = registration;
            }

            registration!.EventId = match.EventId!.Value;
            registration.Status = status.Value;
            registration.CreatedAt = row.SubmittedAt;
            registration.AgeBand = PynMapping.ParseAgeBand(row.AgeBand);
            registration.City = PynMapping.CleanText(row.City, 100);
            registration.Nationality = PynMapping.CleanText(row.Nationality, 100);
            registration.Gender = PynMapping.CleanName(row.Gender, 50);
            registration.HeardAbout = PynMapping.CleanName(row.HeardAbout, 100);
            registration.AttendedBefore = row.AttendedBefore;
            registration.FewerOpportunities = row.FewerOpportunities;

            if (isNew)
                run.RegistrationsInserted++;
            else if (db.Entry(registration).State == EntityState.Modified)
                run.RegistrationsUpdated++;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static string Truncate(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength];
}
