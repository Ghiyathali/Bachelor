using Microsoft.EntityFrameworkCore;
using RestServer.Models;

namespace RestServer.Data;

// Creates the FIRST Admin account in Development ("the master key").
// Registration always gives the lowest role, so without this nobody could ever be Admin.
// The details come from .env - never from code, so they never reach GitHub.
public static class DevSeeder
{
    private const string DemoUsernamePrefix = "dashboard-demo-attendee-";

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

        var userRoleId = await db.Roles
            .Where(role => role.Name == "User")
            .Select(role => role.Id)
            .SingleAsync();

        var existingDemoUsernames = await db.Accounts
            .Where(account => account.Username.StartsWith(DemoUsernamePrefix))
            .Select(account => account.Username)
            .ToHashSetAsync();

        var missingUsernames = Enumerable.Range(1, 16)
            .Select(number => $"{DemoUsernamePrefix}{number:00}")
            .Where(username => !existingDemoUsernames.Contains(username))
            .ToList();

        if (missingUsernames.Count > 0)
        {
            // These accounts have a random, unknown password and exist only to give the
            // development registration records valid foreign keys.
            var unavailablePasswordHash = BCrypt.Net.BCrypt.HashPassword(
                $"{Guid.NewGuid():N}{Guid.NewGuid():N}",
                workFactor: 12);

            foreach (var username in missingUsernames)
            {
                db.Accounts.Add(new Account
                {
                    Username = username,
                    Email = $"{username}@example.invalid",
                    PasswordHash = unavailablePasswordHash,
                    RoleId = userRoleId,
                });
            }

            await db.SaveChangesAsync();
        }

        var demoAccounts = await db.Accounts
            .Where(account => account.Username.StartsWith(DemoUsernamePrefix))
            .OrderBy(account => account.Username)
            .Take(16)
            .ToListAsync();

        var eventIds = events.Select(eventItem => eventItem.Id).ToList();
        var accountIds = demoAccounts.Select(account => account.Id).ToList();
        var existingRegistrations = await db.EventRegistrations
            .Where(registration =>
                eventIds.Contains(registration.EventId) &&
                accountIds.Contains(registration.AccountId))
            .Select(registration => new { registration.EventId, registration.AccountId })
            .ToListAsync();
        var existingPairs = existingRegistrations
            .Select(registration => (registration.EventId, registration.AccountId))
            .ToHashSet();

        var added = 0;
        for (var eventIndex = 0; eventIndex < events.Count; eventIndex++)
        {
            var eventItem = events[eventIndex];
            var registeredCount = Math.Min(demoAccounts.Count, 8 + eventIndex);
            var attendedCount = Math.Max(1, registeredCount - 2 - eventIndex % 3);

            for (var attendeeIndex = 0; attendeeIndex < registeredCount; attendeeIndex++)
            {
                var account = demoAccounts[attendeeIndex];
                if (existingPairs.Contains((eventItem.Id, account.Id)))
                    continue;

                db.EventRegistrations.Add(new EventRegistration
                {
                    EventId = eventItem.Id,
                    AccountId = account.Id,
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
