using System.Text;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using System.Threading.RateLimiting;                 // NEW: FixedWindowRateLimiterOptions, RateLimitPartition
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using RestServer.Auth;
using RestServer.Data;
using RestServer.Sync;

// Load env file
var envFile = Path.Combine(Directory.GetCurrentDirectory(), ".env");
if (File.Exists(envFile))
{
    DotNetEnv.Env.Load(envFile);
}

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

// ---------- Database ----------
var postgresConnectionString = builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException(
        "PostgreSQL is not configured. Set ConnectionStrings__Postgres in rest-server/.env.");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(postgresConnectionString));

// ---------- JWT ----------
var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
if (Encoding.UTF8.GetByteCount(jwtOptions.Key) < 32)
    throw new InvalidOperationException(
        "JWT is not configured. Set Jwt__Key in rest-server/.env (at least 32 characters).");

builder.Services.AddSingleton(jwtOptions);
builder.Services.AddSingleton<TokenService>();

// The "guard": how every incoming token is checked. All rules must pass, otherwise 401.
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                if (!int.TryParse(context.Principal?.FindFirst("sub")?.Value, out var id))
                {
                    context.Fail("Invalid account.");
                    return;
                }
                var account = await db.Accounts.AsNoTracking().Include(a => a.Role)
                    .SingleOrDefaultAsync(a => a.Id == id, context.HttpContext.RequestAborted);
                if (account is null || !account.IsActive)
                {
                    context.Fail("Account is inactive.");
                    return;
                }
                // Never trust a role from a token issued before an administrator changed it.
                var identity = (ClaimsIdentity)context.Principal!.Identity!;
                foreach (var type in new[] { "role", "username", "email" })
                    foreach (var claim in identity.FindAll(type).ToList()) identity.RemoveClaim(claim);
                identity.AddClaim(new Claim("role", account.Role.Name));
                identity.AddClaim(new Claim("username", account.Username));
                identity.AddClaim(new Claim("email", account.Email));
            },
        };
        options.MapInboundClaims = false; // keep our short claim names: "sub", "role", ...
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateLifetime = true,                 // expired token -> 401
            ValidateIssuerSigningKey = true,         // faked/changed token -> 401
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key)),
            RoleClaimType = "role",                  // lets [Authorize(Roles = "Admin")] work later
            NameClaimType = "username",
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });
builder.Services.AddAuthorization(options =>
    options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

// ---------- PYN sync (#69) ----------
// Reads PYN's anonymised views and copies them into our tables (design "PYN Data Integration").
// Not configured (empty connection string) -> "Sync now" answers 503, everything else works normally.
builder.Services.AddSingleton(new PynSyncOptions
{
    ConnectionString = builder.Configuration.GetConnectionString("PynSource"),
    ViewSchema = builder.Configuration.GetValue("PynSync:ViewSchema", "analytics")!,
});
builder.Services.AddScoped<PynSyncService>();

// ---------- Rate limiting (NEW) ----------
// The "bouncer" for the public feedback endpoint: each IP address may submit
// PermitLimit times per window. The IP is only used as an in-memory counter key -
// it is never stored in the database or logged.
var feedbackPermitLimit = builder.Configuration.GetValue("FeedbackRateLimit:PermitLimit", 20);
var feedbackWindowSeconds = builder.Configuration.GetValue("FeedbackRateLimit:WindowSeconds", 60);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("feedback", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = feedbackPermitLimit,
                Window = TimeSpan.FromSeconds(feedbackWindowSeconds),
                QueueLimit = 0, // over the limit -> refuse immediately, don't wait
            }));

    // Same { message } shape as our other errors, so the feedback form can show it.
    options.OnRejected = async (context, cancellationToken) =>
    {
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { message = "Too many submissions. Please wait a minute and try again." },
            cancellationToken);
    };
});

var app = builder.Build();

// #53: placeholder event types for a new, empty database (every environment).
// Needs the AddEventTypes migration - run `dotnet tool run dotnet-ef database update` first.
using (var seedScope = app.Services.CreateScope())
{
    var seedDb = seedScope.ServiceProvider.GetRequiredService<AppDbContext>();
    await EventTypeSeeder.SeedDefaultEventTypesAsync(seedDb, app.Logger);
}

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    // Create the first Admin (Development only)
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await DevSeeder.SeedFirstAdminAsync(db, app.Configuration, app.Logger);
    await DevSeeder.SeedDashboardDemoDataAsync(db, app.Configuration, app.Logger);
}

app.UseHttpsRedirection();

app.UseAuthentication(); // 1. WHO are you?   (reads + checks the token)
app.UseAuthorization();  // 2. Are you ALLOWED? (checks [Authorize])
app.UseRateLimiter();    // 3. NEW: too many requests? (checks [EnableRateLimiting])

app.MapControllers();

app.Run();

// Makes the auto-generated Program class visible to rest-server.Tests (WebApplicationFactory<Program>).
public partial class Program { }
