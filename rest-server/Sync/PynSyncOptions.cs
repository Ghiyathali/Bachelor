namespace RestServer.Sync;

// #69: where the PYN sync reads from. At handover, only these two values change
// (design document, section 8) - the sync code stays the same.
public class PynSyncOptions
{
    // ConnectionStrings__PynSource in .env. Empty = the sync is not configured.
    // Mock: our own Azure database. Handover: PYN's read-only login.
    public string? ConnectionString { get; set; }

    // PynSync__ViewSchema: "pyn_mock_analytics" for the mock, "analytics" at PYN.
    public string ViewSchema { get; set; } = "analytics";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ConnectionString);
}
