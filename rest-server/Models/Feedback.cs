namespace RestServer.Models;

// One anonymous feedback answer for an event (FR-01). It has no link to a person, account
// or sign-up, so it can't be traced back to whoever sent it (NFR-02).
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
