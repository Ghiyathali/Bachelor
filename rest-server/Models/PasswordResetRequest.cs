namespace RestServer.Models;

// "Forgot password?" on the login page: the user picks a new password, but it only takes effect
// after an Admin approves the request. Until then the old password keeps working.
// One open request per account; a new request replaces the old one.
public class PasswordResetRequest
{
    public int Id { get; set; }
    public int AccountId { get; set; }
    public Account Account { get; set; } = null!;

    // The new password is only stored as a bcrypt hash, never as plain text.
    public required string NewPasswordHash { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
