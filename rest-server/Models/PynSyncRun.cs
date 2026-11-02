namespace RestServer.Models;

// #69: one run of the PYN sync. Numbers only - never names, emails or other personal data -
// so Admins can see when the last sync ran and what it did (design document, section 7).
public class PynSyncRun
{
    public int Id { get; set; }

    // "manual" (an Admin pressed "Sync now") or "nightly" (the schedule).
    public required string TriggeredBy { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? FinishedAt { get; set; }
    public bool Succeeded { get; set; }

    // Events
    public int EventsRead { get; set; }
    public int EventsInserted { get; set; }
    public int EventsUpdated { get; set; }
    public int EventsSkipped { get; set; }            // no title, or a date that can't be read
    public int EventTypesCreated { get; set; }        // new PYN topics

    // Sign-ups
    public int RegistrationsRead { get; set; }
    public int RegistrationsInserted { get; set; }
    public int RegistrationsUpdated { get; set; }
    public int RegistrationsEventNotFound { get; set; }   // no synced event with that name
    public int RegistrationsEventAmbiguous { get; set; }  // several events, date doesn't decide
    public int RegistrationsUnknownStatus { get; set; }   // status PYN doesn't normally use

    // Short technical reason when the run failed (no row data).
    public string? Error { get; set; }
}
