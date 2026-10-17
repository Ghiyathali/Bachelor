using Microsoft.EntityFrameworkCore;
using RestServer.Models;

namespace RestServer.Data;

// Creates the FIRST Admin account in Development ("the master key").
// Registration always gives the lowest role, so without this nobody could ever be Admin.
// The details come from .env - never from code, so they never reach GitHub.
public static class DevSeeder
{
    public static async Task SeedFirstAdminAsync(AppDbContext db, IConfiguration config, ILogger logger)
    {
        // Already an Admin in the database? Then do nothing.
        if (await db.Accounts.AnyAsync(a => a.Role.Name == "Admin"))
            return;

        var username = config["SeedAdmin:Username"]?.Trim().ToLowerInvariant();
        var email = config["SeedAdmin:Email"]?.Trim().ToLowerInvariant();
        var password = config["SeedAdmin:Password"];

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning("No Admin exists and SeedAdmin__Username / __Email / __Password are missing in .env.");
            return;
        }

        if (await db.Accounts.AnyAsync(a => a.Username.ToLower() == username || a.Email.ToLower() == email))
        {
            logger.LogWarning("Cannot create the first Admin: username or email {Username}/{Email} is already used.", username, email);
            return;
        }

        var adminRole = await db.Roles.SingleAsync(r => r.Name == "Admin");

        db.Accounts.Add(new Account
        {
            Username = username,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12),
            RoleId = adminRole.Id,
        });
        await db.SaveChangesAsync();
        logger.LogInformation("Created first Admin account {Username}", username);
    }

    public static async Task SeedDashboardDemoDataAsync(
        AppDbContext db,
        IConfiguration config,
        ILogger logger)
    {
        if (!config.GetValue("SeedDashboardDemoData", false))
            return;

        var events = await db.Events
            .OrderByDescending(eventItem => eventItem.StartsAt)
            .Take(6)
            .ToListAsync();

        if (events.Count == 0)
        {
            logger.LogInformation("Dashboard demo registrations were not seeded because no events exist.");
            return;
        }

        var eventIds = events.Select(eventItem => eventItem.Id).ToList();
        var eventsWithRegistrations = await db.EventRegistrations
            .Where(registration => eventIds.Contains(registration.EventId))
            .Select(registration => registration.EventId)
            .Distinct()
            .ToHashSetAsync();

        var added = 0;
        for (var eventIndex = 0; eventIndex < events.Count; eventIndex++)
        {
            var eventItem = events[eventIndex];
            if (eventsWithRegistrations.Contains(eventItem.Id))
                continue;

            var registeredCount = 8 + eventIndex;
            var attendedCount = Math.Max(1, registeredCount - 2 - eventIndex % 3);

            for (var attendeeIndex = 0; attendeeIndex < registeredCount; attendeeIndex++)
            {
                db.EventRegistrations.Add(new EventRegistration
                {
                    EventId = eventItem.Id,
                    Status = attendeeIndex < attendedCount
                        ? RegistrationStatus.Attended
                        : RegistrationStatus.Registered,
                });
                added++;
            }
        }

        if (added == 0)
            return;

        await db.SaveChangesAsync();
        logger.LogInformation("Created {Count} development dashboard demo registrations.", added);
    }
}
