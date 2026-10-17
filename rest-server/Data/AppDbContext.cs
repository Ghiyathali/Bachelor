using Microsoft.EntityFrameworkCore;
using RestServer.Models;

namespace RestServer.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<TodoItem> TodoItems => Set<TodoItem>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<Feedback> Feedback => Set<Feedback>();
    public DbSet<EventRegistration> EventRegistrations => Set<EventRegistration>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Role>(entity =>
        {
            entity.Property(role => role.Name).HasMaxLength(100);
            entity.HasIndex(role => role.Name).IsUnique();
            entity.HasData(
                new Role { Id = 1, Name = "Admin" },
                new Role { Id = 2, Name = "Event Manager" },
                new Role { Id = 3, Name = "Marketing Manager" },
                new Role { Id = 4, Name = "User" });
        });

        modelBuilder.Entity<Account>(entity =>
        {
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

        modelBuilder.Entity<Event>(entity =>
        {
            entity.Property(eventItem => eventItem.Name).HasMaxLength(200);
            entity.Property(eventItem => eventItem.Location).HasMaxLength(300);
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
            entity.ToTable(table => table.HasCheckConstraint(
                "CK_EventRegistrations_Status",
                "\"Status\" BETWEEN 0 AND 3"));

            entity.HasOne(registration => registration.Event)
                .WithMany(eventItem => eventItem.Registrations)
                .HasForeignKey(registration => registration.EventId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
