namespace RestServer.Models;

public class Role
{
    public int Id { get; set; }
    public required string Name { get; set; }

    public ICollection<Account> Accounts { get; set; } = new List<Account>();
}
