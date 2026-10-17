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

public class EventRegistration
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public RegistrationStatus Status { get; set; } = RegistrationStatus.Pending;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Event Event { get; set; } = null!;
}
