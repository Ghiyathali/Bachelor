using RestServer.Models;

namespace RestServer.Dashboard;

// FR-05: the season is derived from the event date and never stored.
public enum Season
{
    Winter, // December - February
    Spring, // March - May
    Summer, // June - August
    Autumn, // September - November
}

// #25 / FR-05: the dashboard filter bar. Every dashboard endpoint binds the same query
// parameters, so all tiles and charts are filtered in exactly the same way:
//   ?from=2026-03-01&to=2026-06-30&eventId=3&eventTypeId=2&season=Spring
//    &city=Horsens&ageBand=From18To24&gender=Female
//
// Event filters (date, event, event type, season) apply to events, sign-ups AND feedback.
// People filters (city, age band, gender) apply to sign-ups only: feedback is anonymous
// and has no demographics, so it can never be filtered by them.
public class DashboardFilter
{
    // NFR-02: any displayed group smaller than this is suppressed (k-anonymity, k = 5).
    public const int MinGroupSize = 5;

    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    public int? EventId { get; set; }
    public int? EventTypeId { get; set; }
    public Season? Season { get; set; }
    public string? City { get; set; }
    public AgeBand? AgeBand { get; set; }
    public string? Gender { get; set; }

    // Walk-ins have no city, age or gender, so they only count when no people filter is used.
    public bool IncludesWalkIns => !HasPeopleFilter;

    public bool HasPeopleFilter =>
        !string.IsNullOrWhiteSpace(City) || AgeBand.HasValue || !string.IsNullOrWhiteSpace(Gender);

    // Returns an error message for an impossible filter, or null when it is valid.
    public string? Validate()
    {
        if (From > To)
            return "'From' must be on or before 'To'.";
        if (From is { Year: < 2 or > 9998 } || To is { Year: < 2 or > 9998 })
            return "Use dates between the years 2 and 9998.";
        return null;
    }

    public IQueryable<Event> ApplyToEvents(IQueryable<Event> events)
    {
        if (From.HasValue)
        {
            var start = new DateTimeOffset(From.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
            events = events.Where(e => e.StartsAt >= start);
        }
        if (To.HasValue)
        {
            // "To" is inclusive: everything before the start of the next day.
            var end = new DateTimeOffset(To.Value.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
            events = events.Where(e => e.StartsAt < end);
        }
        if (EventId.HasValue)
            events = events.Where(e => e.Id == EventId);
        if (EventTypeId.HasValue)
            events = events.Where(e => e.EventTypeId == EventTypeId);
        if (Season.HasValue)
        {
            var months = SeasonMonths(Season.Value);
            events = events.Where(e => months.Contains(e.StartsAt.UtcDateTime.Month));
        }
        return events;
    }

    // Sign-ups for the filtered events, narrowed further by city, age band and gender.
    public IQueryable<EventRegistration> ApplyToSignUps(IQueryable<EventRegistration> signUps, IQueryable<Event> filteredEvents)
    {
        signUps = signUps.Where(r => filteredEvents.Any(e => e.Id == r.EventId));
        if (!string.IsNullOrWhiteSpace(City))
        {
            var city = City.Trim().ToLower();
            signUps = signUps.Where(r => r.City != null && r.City.ToLower() == city);
        }
        if (AgeBand.HasValue)
            signUps = signUps.Where(r => r.AgeBand == AgeBand);
        if (!string.IsNullOrWhiteSpace(Gender))
        {
            var gender = Gender.Trim().ToLower();
            signUps = signUps.Where(r => r.Gender != null && r.Gender.ToLower() == gender);
        }
        return signUps;
    }

    // Feedback for the filtered events. People filters never apply (feedback is anonymous).
    public static IQueryable<Feedback> ApplyToFeedback(IQueryable<Feedback> feedback, IQueryable<Event> filteredEvents) =>
        feedback.Where(f => filteredEvents.Any(e => e.Id == f.EventId));

    // NFR-02: a count below the minimum group size is never sent to the app.
    public static int? Suppress(int count) => count >= MinGroupSize ? count : null;

    private static int[] SeasonMonths(Season season) => season switch
    {
        Dashboard.Season.Winter => [12, 1, 2],
        Dashboard.Season.Spring => [3, 4, 5],
        Dashboard.Season.Summer => [6, 7, 8],
        _ => [9, 10, 11],
    };
}
