using Microsoft.EntityFrameworkCore;
using RestServer.Models;
using RestServer.Auth;

namespace RestServer.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<EventType> EventTypes => Set<EventType>();
    public DbSet<Feedback> Feedback => Set<Feedback>();
    public DbSet<EventRegistration> EventRegistrations => Set<EventRegistration>();
    public DbSet<PynSyncRun> PynSyncRuns => Set<PynSyncRun>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Role>(entity =>
        {
            entity.Property(role => role.Name).HasMaxLength(100);
            entity.HasIndex(role => role.Name).IsUnique();
            entity.HasData(
                new Role { Id = 1, Name = RoleNames.Admin },
                new Role { Id = 2, Name = RoleNames.EventManager },
                new Role { Id = 3, Name = RoleNames.MarketingManager },
                new Role { Id = 4, Name = RoleNames.StandardUser });
        });

        modelBuilder.Entity<Account>(entity =>
        {
            entity.Property(account => account.IsActive).HasDefaultValue(true);
            entity.Property(account => account.Username).HasMaxLength(100);
            entity.Property(account => account.Email).HasMaxLength(256);
            entity.Property(account => account.PasswordHash).HasMaxLength(512);
            entity.HasIndex(account => account.Username).IsUnique();
            entity.HasIndex(account => account.Email).IsUnique();

            entity.HasOne(account => account.Role)
                .WithMany(role => role.Accounts)
                .HasForeignKey(account => account.RoleId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // #53: event categories. Names are unique, so the type filter never shows duplicates.
        modelBuilder.Entity<EventType>(entity =>
        {
            entity.Property(eventType => eventType.Name).HasMaxLength(100);
            entity.HasIndex(eventType => eventType.Name).IsUnique();
        });

        modelBuilder.Entity<Event>(entity =>
        {
            entity.Property(eventItem => eventItem.Name).HasMaxLength(200);
            entity.Property(eventItem => eventItem.Location).HasMaxLength(300);
            entity.ToTable(table => table.HasCheckConstraint("CK_Events_WalkIns", "\"WalkIns\" >= 0"));

            // #69: one PYN event = at most one row here (empty for events made in our app).
            entity.HasIndex(eventItem => eventItem.ExternalId).IsUnique();

            // #53: optional type. Deleting a type keeps its events and sets their type to null.
            entity.HasOne(eventItem => eventItem.EventType)
                .WithMany(eventType => eventType.Events)
                .HasForeignKey(eventItem => eventItem.EventTypeId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Feedback>(entity =>
        {
            entity.ToTable(table =>
            {
                table.HasCheckConstraint("CK_Feedback_Rating", "\"Rating\" BETWEEN 1 AND 5");
                table.HasCheckConstraint("CK_Feedback_UsefulnessRating", "\"UsefulnessRating\" BETWEEN 1 AND 5");
                table.HasCheckConstraint("CK_Feedback_InclusionRating", "\"InclusionRating\" BETWEEN 1 AND 5");
            });
            entity.Property(feedback => feedback.Comment).HasMaxLength(2000);
            entity.Property(feedback => feedback.WhatWorkedWell).HasMaxLength(2000);
            entity.Property(feedback => feedback.WhatCouldBeImproved).HasMaxLength(2000);

            entity.HasOne(feedback => feedback.Event)
                .WithMany(eventItem => eventItem.Feedback)
                .HasForeignKey(feedback => feedback.EventId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EventRegistration>(entity =>
        {
            entity.ToTable(table =>
            {
                table.HasCheckConstraint(
                    "CK_EventRegistrations_Status",
                    "\"Status\" BETWEEN 0 AND 3");
                table.HasCheckConstraint(
                    "CK_EventRegistrations_AgeBand",
                    "\"AgeBand\" IS NULL OR \"AgeBand\" BETWEEN 0 AND 3");
            });

            entity.Property(registration => registration.City).HasMaxLength(100);
            entity.Property(registration => registration.Nationality).HasMaxLength(100);
            entity.Property(registration => registration.Gender).HasMaxLength(50);
            entity.Property(registration => registration.HeardAbout).HasMaxLength(100);

            // #69: one PYN sign-up = at most one row here, so re-running the sync never duplicates.
            entity.HasIndex(registration => registration.ExternalId).IsUnique();

            entity.HasOne(registration => registration.Event)
                .WithMany(eventItem => eventItem.Registrations)
                .HasForeignKey(registration => registration.EventId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // #69: history of PYN sync runs. Indexed by start time, so "last run" is a quick lookup.
        modelBuilder.Entity<PynSyncRun>(entity =>
        {
            entity.Property(run => run.TriggeredBy).HasMaxLength(20);
            entity.Property(run => run.Error).HasMaxLength(1000);
            entity.HasIndex(run => run.StartedAt);
        });
    }
}
