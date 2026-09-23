namespace RestServer.Models;

public class Account
{
    public int Id { get; set; }
    public required string Username { get; set; }
    // Passwords must be stored as a one-way hash, never as plaintext.
    public required string PasswordHash { get; set; }
    public required string Email { get; set; }

    public int RoleId { get; set; }
    public required Role Role { get; set; }
}
