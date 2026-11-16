using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace RestServer.Data;

// `dotnet run --project rest-server -- create-admin`
// Creates the first Admin in the database from rest-server/.env, for example in production.
// It asks for the details in the terminal, so the password is never written in code, Git or the app.
public static class CreateAdminCommand
{
    public const string Name = "create-admin";

    public static async Task<int> RunAsync(AppDbContext db, string connectionString, TextReader input, TextWriter output,
        Func<string, string?>? readSecret = null)
    {
        readSecret ??= prompt => { output.Write(prompt); return input.ReadLine(); };

        // Show where the account will be created (never the password), so nobody writes to the wrong database.
        var target = new NpgsqlConnectionStringBuilder(connectionString);
        output.WriteLine($"Database: {target.Database} on {target.Host}");

        var pending = await db.Database.GetPendingMigrationsAsync();
        if (pending.Any())
        {
            output.WriteLine("This database is missing migrations. Run `dotnet ef database update` first. Nothing was created.");
            return 1;
        }

        output.Write("Username: ");
        var username = input.ReadLine();
        output.Write("Email: ");
        var email = input.ReadLine();
        var password = readSecret("Password: ");
        var confirm = readSecret("Confirm password: ");
        if (password != confirm)
        {
            output.WriteLine("The passwords do not match. Nothing was created.");
            return 1;
        }

        output.Write($"Create this Admin in {target.Database} on {target.Host}? (y/n): ");
        if (!string.Equals(input.ReadLine()?.Trim(), "y", StringComparison.OrdinalIgnoreCase))
        {
            output.WriteLine("Cancelled. Nothing was created.");
            return 1;
        }

        var result = await AdminAccounts.CreateAsync(db, username, email, password);
        output.WriteLine(result.Message);
        return result.Created ? 0 : 1;
    }

    // Reads a password without showing it. Falls back to a normal line when the input is not a real
    // terminal (for example when the answers are piped in).
    public static string? ReadHidden(string prompt)
    {
        Console.Write(prompt);
        if (Console.IsInputRedirected) return Console.ReadLine();
        var text = new System.Text.StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter) break;
            if (key.Key == ConsoleKey.Backspace) { if (text.Length > 0) text.Length--; continue; }
            if (!char.IsControl(key.KeyChar)) text.Append(key.KeyChar);
        }
        Console.WriteLine();
        return text.ToString();
    }
}
