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

        // Fixed seed: every teammate gets the same mock answers.
        var random = new Random(19);

        var added = 0;
        for (var eventIndex = 0; eventIndex < events.Count; eventIndex++)
        {
            var eventItem = events[eventIndex];
            if (eventsWithRegistrations.Contains(eventItem.Id))
                continue;

            var registeredCount = 8 + eventIndex;
            var acceptedCount = Math.Max(1, registeredCount - 2 - eventIndex % 3);

            for (var attendeeIndex = 0; attendeeIndex < registeredCount; attendeeIndex++)
            {
                var registration = new EventRegistration
                {
                    EventId = eventItem.Id,
                    // Most get a spot; the rest are spread over the other PYN statuses.
                    Status = attendeeIndex < acceptedCount
                        ? RegistrationStatus.Accepted
                        : (attendeeIndex % 3) switch
                        {
                            0 => RegistrationStatus.Waiting,
                            1 => RegistrationStatus.Rejected,
                            _ => RegistrationStatus.Pending,
                        },
                };
                ApplyMockDemographics(registration, random);
                db.EventRegistrations.Add(registration);
                added++;
            }
        }

        // Demo sign-ups created before the demographic fields existed get mock answers too,
        // so the dashboard has something to show. Only touches rows with no answers at all.
        var withoutDemographics = await db.EventRegistrations
            .Where(registration => eventIds.Contains(registration.EventId)
                && registration.AgeBand == null
                && registration.City == null
                && registration.HeardAbout == null)
            .ToListAsync();
        foreach (var registration in withoutDemographics)
            ApplyMockDemographics(registration, random);

        if (added == 0 && withoutDemographics.Count == 0)
            return;

        await db.SaveChangesAsync();
        logger.LogInformation(
            "Created {Added} development dashboard demo registrations and filled demographics on {Filled} existing ones.",
            added, withoutDemographics.Count);
    }

    // Mock answers only - NOT real Pangaea data. Values repeat in the arrays
    // so some answers are more common, like in a real sign-up list.
    private static readonly string[] MockCities =
        ["Copenhagen", "Copenhagen", "Copenhagen", "Aarhus", "Aarhus", "Odense", "Aalborg", "Horsens"];
    private static readonly AgeBand[] MockAgeBands =
        [AgeBand.Under18, AgeBand.From18To24, AgeBand.From18To24, AgeBand.From18To24,
         AgeBand.From25To30, AgeBand.From25To30, AgeBand.Over30];
    private static readonly string[] MockNationalities =
        ["Danish", "Danish", "Danish", "Syrian", "Ukrainian", "Afghan", "Eritrean", "Iranian", "Somali"];
    private static readonly string[] MockGenders =
        ["Female", "Female", "Male", "Male", "Non-binary", "Prefer not to say"];
    private static readonly string[] MockHeardAbout =
        ["Instagram", "Instagram", "Friend", "Friend", "Facebook", "School", "Partner organisation", "Website"];

    private static void ApplyMockDemographics(EventRegistration registration, Random random)
    {
        registration.City = MockCities[random.Next(MockCities.Length)];
        registration.AgeBand = MockAgeBands[random.Next(MockAgeBands.Length)];
        registration.Nationality = MockNationalities[random.Next(MockNationalities.Length)];
        registration.Gender = MockGenders[random.Next(MockGenders.Length)];
        registration.AttendedBefore = random.Next(100) < 40;   // about 40 % returning
        registration.HeardAbout = MockHeardAbout[random.Next(MockHeardAbout.Length)];
    }
}
