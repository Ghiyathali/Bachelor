using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using RestServer.Auth;
using RestServer.Models;

namespace RestServer.Data;

// Creates an Admin account directly in the database. Used for the very first Admin, because
// inside the app only an Admin can create accounts. Same rules as creating an account in the
// app (FR-14), so a first Admin is never weaker than any other account.
public static partial class AdminAccounts
{
    public record Result(bool Created, string Message, Account? Account = null);

    [GeneratedRegex(@"^[^@\s]+$")]
    private static partial Regex UsernamePattern();

    public static async Task<Result> CreateAsync(
        AppDbContext db, string? username, string? email, string? password, CancellationToken cancellationToken = default)
    {
        // Usernames and emails are stored in lowercase everywhere, so "Jurgita" becomes "jurgita".
        username = username?.Trim().ToLowerInvariant() ?? "";
        email = email?.Trim().ToLowerInvariant() ?? "";
        password ??= "";

        if (username.Length is < 3 or > 30 || !UsernamePattern().IsMatch(username))
            return new(false, "The username must be 3 to 30 characters, without '@' or spaces.");
        if (email.Length > 256 || !new EmailAddressAttribute().IsValid(email))
            return new(false, "The email is not a valid address.");
        if (password.Length is < 8 or > 72)   // bcrypt only uses the first 72 bytes
            return new(false, "The password must be 8 to 72 characters.");

        if (await db.Accounts.AnyAsync(a => a.Username.ToLower() == username, cancellationToken))
            return new(false, $"The username '{username}' is already taken. Nothing was created.");
        if (await db.Accounts.AnyAsync(a => a.Email.ToLower() == email, cancellationToken))
            return new(false, $"The email '{email}' is already registered. Nothing was created.");

        var adminRole = await db.Roles.SingleAsync(r => r.Name == RoleNames.Admin, cancellationToken);
        var account = new Account
        {
            Username = username,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12),
            RoleId = adminRole.Id,
        };
        db.Accounts.Add(account);
        await db.SaveChangesAsync(cancellationToken);
        return new(true, $"Created Admin account '{username}' ({email}).", account);
    }
}
