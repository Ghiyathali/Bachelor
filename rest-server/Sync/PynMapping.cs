using System.Globalization;
using System.Text.RegularExpressions;
using RestServer.Models;

namespace RestServer.Sync;

// #69: the conversion rules of the PYN sync, as plain functions - no database, no network.
// Every value read from PYN's views passes through here before it is stored.
// Kept separate from the sync so each rule can be tested on its own (PynMappingTests).
// The rules follow the design document "PYN Data Integration", section 5.
public static class PynMapping
{
    private static readonly Regex Whitespace = new(@"\s+", RegexOptions.Compiled);

    // ---------- Text ----------

    // City / nationality: "  horsens " -> "Horsens", "danish " -> "Danish". Empty -> null.
    // Cut to maxLength, so a long value can never break the database column.
    public static string? CleanText(string? value, int maxLength)
    {
        var tidy = CollapseSpaces(value);
        if (tidy is null)
            return null;

        var titled = CultureInfo.InvariantCulture.TextInfo.ToTitleCase(tidy.ToLowerInvariant());
        return Truncate(titled, maxLength);
    }

    // Event title / event type: spaces tidied, letter case kept as PYN wrote it.
    public static string? CleanName(string? value, int maxLength)
    {
        var tidy = CollapseSpaces(value);
        return tidy is null ? null : Truncate(tidy, maxLength);
    }

    // Key for comparing names: spaces tidied and letter case ignored,
    // so "Reggaeton  dance workshop" and "Reggaeton Dance Workshop" are the same.
    public static string MatchKey(string? value) => (CollapseSpaces(value) ?? "").ToLowerInvariant();

    private static string? CollapseSpaces(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : Whitespace.Replace(value.Trim(), " ");

    private static string Truncate(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength].TrimEnd();

    // ---------- Age band and status ----------

    // PYN's view has already turned the exact age into a band name (design, Appendix A).
    // Only the exact names are accepted; anything else -> null, never a wrong band.
    public static AgeBand? ParseAgeBand(string? value) => value?.Trim() switch
    {
        "Under18" => AgeBand.Under18,
        "From18To24" => AgeBand.From18To24,
        "From25To30" => AgeBand.From25To30,
        "Over30" => AgeBand.Over30,
        _ => null,
    };

    // PYN uses the same four statuses as we do. Unknown -> null (the sync skips that row).
    public static RegistrationStatus? ParseStatus(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        "pending" => RegistrationStatus.Pending,
        "accepted" => RegistrationStatus.Accepted,
        "waiting" => RegistrationStatus.Waiting,
        "rejected" => RegistrationStatus.Rejected,
        _ => null,
    };

    // ---------- Dates ----------

    private static readonly string[] DateFormats =
    [
        "yyyy-MM-dd",
        "yyyy-MM-dd'T'HH:mm",
        "yyyy-MM-dd'T'HH:mm:ss",
        "yyyy-MM-dd HH:mm",
        "yyyy-MM-dd HH:mm:ss",
    ];

    // PYN stores event dates as TEXT. Accepts an ISO date with an optional time, treated as UTC,
    // or a full date-time with an offset ("2026-10-14T18:00:00+02:00").
    // Anything else -> null, and the sync skips the event instead of guessing.
    public static DateTimeOffset? ParseEventDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var text = value.Trim();

        if (DateTime.TryParseExact(text, DateFormats, CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var plain))
            return new DateTimeOffset(DateTime.SpecifyKind(plain, DateTimeKind.Utc));

        if (DateTimeOffset.TryParseExact(text, "yyyy-MM-dd'T'HH:mm:sszzz", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var withOffset))
            return withOffset.ToUniversalTime();

        return null;
    }

    // ---------- Matching a sign-up to its event (design 5.6) ----------

    public record EventCandidate(int EventId, string Name, DateTimeOffset StartsAt);

    public enum MatchOutcome { Matched, NotFound, Ambiguous }

    public record EventMatch(MatchOutcome Outcome, int? EventId);

    // 1. Events with the same name (ignoring letter case and spaces).
    // 2. Exactly one -> that event.
    // 3. Several -> the one starting on the sign-up's event_date.
    // 4. None, or still several -> not linked; the sync reports it.
    public static EventMatch MatchEvent(IEnumerable<EventCandidate> events, string? eventName, DateOnly? eventDate)
    {
        var key = MatchKey(eventName);
        if (key.Length == 0)
            return new EventMatch(MatchOutcome.NotFound, null);

        var sameName = events.Where(candidate => MatchKey(candidate.Name) == key).ToList();
        if (sameName.Count == 0)
            return new EventMatch(MatchOutcome.NotFound, null);
        if (sameName.Count == 1)
            return new EventMatch(MatchOutcome.Matched, sameName[0].EventId);
        if (eventDate is null)
            return new EventMatch(MatchOutcome.Ambiguous, null);

        var sameDay = sameName
            .Where(candidate => DateOnly.FromDateTime(candidate.StartsAt.UtcDateTime) == eventDate.Value)
            .ToList();

        return sameDay.Count == 1
            ? new EventMatch(MatchOutcome.Matched, sameDay[0].EventId)
            : new EventMatch(MatchOutcome.Ambiguous, null);
    }
}
