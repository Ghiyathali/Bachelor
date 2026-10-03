namespace RestServer.Models;

public class Feedback
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int Rating { get; set; }
    // Nullable only so feedback collected before these questions were introduced
    // is not misrepresented. New API submissions require both ratings.
    public int? UsefulnessRating { get; set; }
    public int? InclusionRating { get; set; }
    public string? WhatWorkedWell { get; set; }
    public string? WhatCouldBeImproved { get; set; }
    public string? Comment { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Event Event { get; set; } = null!;
}
