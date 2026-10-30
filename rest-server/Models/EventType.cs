namespace RestServer.Models;

// #53: a category of event (e.g. Workshop, Sports). Stored as data, not code,
// so PYN can add, rename or remove types in the app when their events change.
public class EventType
{
    public int Id { get; set; }
    public required string Name { get; set; }

    public ICollection<Event> Events { get; set; } = new List<Event>();
}
