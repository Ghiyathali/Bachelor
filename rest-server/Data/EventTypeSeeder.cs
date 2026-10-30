using Microsoft.EntityFrameworkCore;
using RestServer.Models;

namespace RestServer.Data;

// #53: gives a new, empty database a starting list of event types.
// These are PLACEHOLDERS based on PYN's public events page - to be confirmed with PYN.
// Runs only when the table is EMPTY: once an Admin or Event Manager renames or deletes
// types in the app, this seeder never touches them again.
public static class EventTypeSeeder
{
    public static readonly string[] PlaceholderTypes =
        ["Workshop", "Sports", "Cultural evening", "Creative arts", "Social meetup"];

    public static async Task SeedDefaultEventTypesAsync(AppDbContext db, ILogger logger)
    {
        if (await db.EventTypes.AnyAsync())
            return;

        db.EventTypes.AddRange(PlaceholderTypes.Select(name => new EventType { Name = name }));
        try
        {
            await db.SaveChangesAsync();
            logger.LogInformation("Created {Count} placeholder event types.", PlaceholderTypes.Length);
        }
        catch (DbUpdateException)
        {
            // Another server instance seeded them at the same moment (unique name index) - nothing to do.
            logger.LogInformation("Placeholder event types were already created by another instance.");
        }
    }
}
