namespace RestServer.Models;

public class Account
{
    public int Id { get; set; }
    public required string Username { get; set; }
    // Passwords must be stored as a one-way hash, never as plaintext.
    public required string PasswordHash { get; set; }
    public required string Email { get; set; }

    public int RoleId { get; set; }

    // Not "required": we create accounts by setting RoleId only.
    // EF Core fills this property when we load it with .Include(a => a.Role).
    // "= null!" tells the compiler: "trust me, EF will fill this in".
    public Role Role { get; set; } = null!;
    public ICollection<EventRegistration> EventRegistrations { get; set; } = new List<EventRegistration>();
}
