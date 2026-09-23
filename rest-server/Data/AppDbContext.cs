using Microsoft.EntityFrameworkCore;
using RestServer.Models;

namespace RestServer.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<TodoItem> TodoItems => Set<TodoItem>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Role> Roles => Set<Role>();

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
    }
}
