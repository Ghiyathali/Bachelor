namespace RestServer.Models;

public class Event
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }
    public string? Location { get; set; }
    public bool IsFeedbackOpen { get; set; }

    public ICollection<Feedback> Feedback { get; set; } = new List<Feedback>();
}
