namespace RestServer.Auth;

// A simple "settings box" that mirrors the "Jwt" section of the configuration.
// Issuer/Audience/ExpiryMinutes come from appsettings.json.
// Key comes from .env (Jwt__Key) because it is SECRET.
public class JwtOptions
{
    public string Issuer { get; set; } = "";     // who created the token (our API)
    public string Audience { get; set; } = "";   // who the token is meant for (our desktop app)
    public string Key { get; set; } = "";        // secret signing key
    public int ExpiryMinutes { get; set; } = 60; // how long a login lasts
}
