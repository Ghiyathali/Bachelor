namespace RestServer.Models;

// Same values as Pangaea's own sign-up data (event_registrations.status),
// so real data can be imported later without conversion.
public enum RegistrationStatus
{
    Pending = 0,   // signed up, not reviewed yet
    Accepted = 1,  // got a spot at the event
    Waiting = 2,   // on the waiting list
    Rejected = 3,  // did not get a spot
}

// We store an age RANGE, never the exact age (GDPR / NFR-02: data minimisation).
// Pangaea stores the exact age; it is converted to a band when imported.
public enum AgeBand
{
    Under18 = 0,     // < 18
    From18To24 = 1,  // 18-24
    From25To30 = 2,  // 25-30
    Over30 = 3,      // 31 and older
}

// One anonymous sign-up for an event. No name, email or account - only
// the demographic answers needed for the dashboard (FR-03).
// All demographic fields are optional: older rows and people who skip a
// question simply have no value.
public class EventRegistration
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public RegistrationStatus Status { get; set; } = RegistrationStatus.Pending;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public string? City { get; set; }
    public AgeBand? AgeBand { get; set; }
    public string? Nationality { get; set; }
    public string? Gender { get; set; }
    public bool? AttendedBefore { get; set; }   // returning participant?
    public string? HeardAbout { get; set; }     // promotion channel

    // Erasmus+ "fewer opportunities" (economic, social, geographic or health barriers).
    // Sensitive: only a yes/no, never the reason. Only shown as totals, and groups
    // smaller than 5 people must be hidden so nobody can be recognised.
    public bool? FewerOpportunities { get; set; }

    public Event Event { get; set; } = null!;
}
