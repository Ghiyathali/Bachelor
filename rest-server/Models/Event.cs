namespace RestServer.Models;

public class Event
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }
    public string? Location { get; set; }
    public bool IsFeedbackOpen { get; set; }

    // Walk-ins: people who came without signing up, entered by staff after the event.
    // Only a number, never a person, so nobody can be counted twice and no personal data is stored.
    // They count in participant totals, but not in city/age/gender breakdowns (FR-03: unknown values).
    public int WalkIns { get; set; }

    // #53: optional - events created before types existed (or not yet categorised) stay valid.
    // Deleting a type sets this back to null; the event itself is kept.
    public int? EventTypeId { get; set; }
    public EventType? EventType { get; set; }

    // #69: PYN's events.id (uuid) when the event was synced from PYN's database.
    // Null for events created in our app. Lets every sync find the same event again.
    public Guid? ExternalId { get; set; }

    public ICollection<Feedback> Feedback { get; set; } = new List<Feedback>();
    public ICollection<EventRegistration> Registrations { get; set; } = new List<EventRegistration>();
}
