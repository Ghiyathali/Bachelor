using Microsoft.EntityFrameworkCore;
using RestServer.Models;

namespace RestServer.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<TodoItem> TodoItems => Set<TodoItem>();
}
