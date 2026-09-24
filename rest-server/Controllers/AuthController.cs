using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace RestServer.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    // ---------- PROTECTED TEST ----------
    // GET /api/auth/me - only works with a valid token.
    // (register and login are added in the next commits)
    [HttpGet("me")]
    [Authorize]
    public IActionResult Me() => Ok(new
    {
        id = User.FindFirst("sub")?.Value,
        username = User.FindFirst("username")?.Value,
        email = User.FindFirst("email")?.Value,
        role = User.FindFirst("role")?.Value,
    });
}
