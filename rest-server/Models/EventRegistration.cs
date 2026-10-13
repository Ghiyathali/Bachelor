namespace RestServer.Models;

public enum RegistrationStatus
{
    Registered = 0,
    Attended = 1,
    Cancelled = 2,
}

public class EventRegistration
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int AccountId { get; set; }
    public RegistrationStatus Status { get; set; } = RegistrationStatus.Registered;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Event Event { get; set; } = null!;
    public Account Account { get; set; } = null!;
}
