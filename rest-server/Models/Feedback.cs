namespace RestServer.Models;

public class Feedback
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int AccountId { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Event Event { get; set; } = null!;
    public Account Account { get; set; } = null!;
}
