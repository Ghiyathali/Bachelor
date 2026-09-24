using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using RestServer.Models;

namespace RestServer.Auth;

// Turns a logged-in Account into a signed JWT string ("prints the wristband").
public class TokenService(JwtOptions options)
{
    public (string Token, DateTimeOffset ExpiresAt) CreateToken(Account account)
    {
        var expiresAt = DateTimeOffset.UtcNow.AddMinutes(options.ExpiryMinutes);

        // Claims = the facts written INSIDE the token (readable by anyone, so nothing secret!)
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, account.Id.ToString()),        // who (account id)
            new Claim("username", account.Username),
            new Claim(JwtRegisteredClaimNames.Email, account.Email),
            new Claim("role", account.Role.Name),                                // what they may do
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),   // unique token id
        };

        // The secret key becomes the "stamp" that makes the token impossible to fake.
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Key));

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = options.Issuer,
            Audience = options.Audience,
            Subject = new ClaimsIdentity(claims),
            Expires = expiresAt.UtcDateTime,
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256),
        };

        return (new JsonWebTokenHandler().CreateToken(descriptor), expiresAt);
    }
}
