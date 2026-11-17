namespace RestServer.Models;

// A staff role: Admin, Event Manager, Marketing Manager or Standard User. The rows are seeded in
// AppDbContext; RoleNames holds the same names for [Authorize(Roles = ...)].
public class Role
{
    public int Id { get; set; }
    public required string Name { get; set; }

    public ICollection<Account> Accounts { get; set; } = new List<Account>();
}
