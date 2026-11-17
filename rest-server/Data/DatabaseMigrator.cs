using Microsoft.EntityFrameworkCore;

namespace RestServer.Data;

// Creates or updates the tables when the app starts, so a new database (for example PYN's own)
// works without running `dotnet ef database update` by hand.
// Safe by design: migrations only ADD tables and columns, already applied ones are skipped,
// and EF Core takes a database lock so two apps starting at once cannot apply them twice.
// Turn it off with Database__AutoMigrate=false to manage the tables yourself.
public static class DatabaseMigrator
{
    public static async Task ApplyPendingAsync(AppDbContext db, ILogger logger)
    {
        var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
        if (pending.Count == 0)
            return;

        logger.LogInformation("Updating the database tables: {Migrations}", string.Join(", ", pending));
        try
        {
            await db.Database.MigrateAsync();
        }
        catch (Exception exception)
        {
            // Stop with a clear message instead of starting with half-created tables.
            throw new InvalidOperationException(
                "Could not create or update the database tables. Check that the database user may create tables, " +
                "or set Database__AutoMigrate=false and run `dotnet ef database update` yourself.", exception);
        }
        logger.LogInformation("Database tables are up to date.");
    }
}
