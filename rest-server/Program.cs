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
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;

// Load env file
var envFile = Path.Combine(Directory.GetCurrentDirectory(), ".env");
var isDesktop = Environment.GetEnvironmentVariable("PANGAEA_DESKTOP_MODE") == "1";
if (!isDesktop && File.Exists(envFile))
{
    DotNetEnv.Env.Load(envFile);
}

var builder = WebApplication.CreateBuilder(args);
if (isDesktop)
{
    // Reuse the installation's port to preserve the renderer's localStorage origin.
    var port = int.Parse(Environment.GetEnvironmentVariable("PANGAEA_DESKTOP_PORT") ?? "0");
    builder.WebHost.ConfigureKestrel(options => options.Listen(System.Net.IPAddress.Loopback, port));
}

builder.Services.AddControllers();
builder.Services.AddOpenApi();

// ---------- Database ----------
var postgresConnectionString = builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException(
        "PostgreSQL is not configured. Use the desktop connection settings or set ConnectionStrings__Postgres in the server environment.");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(postgresConnectionString));

// ---------- JWT ----------
var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
if (Encoding.UTF8.GetByteCount(jwtOptions.Key) < 32)
    throw new InvalidOperationException(
        "JWT is not configured. Use the desktop connection settings or set Jwt__Key in the server environment (at least 32 characters).");

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
                // A login from before the last password change is no longer valid.
                // Tokens store their creation time in whole seconds, so compare in seconds.
                if (account.PasswordChangedAt is { } changedAt &&
                    context.SecurityToken is Microsoft.IdentityModel.JsonWebTokens.JsonWebToken token &&
                    token.IssuedAt < changedAt.UtcDateTime.AddTicks(-(changedAt.UtcDateTime.Ticks % TimeSpan.TicksPerSecond)))
                {
                    context.Fail("Password was changed.");
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

    // "Forgot password?" is open without login, so it gets its own small limit per IP.
    options.AddPolicy("password-reset", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = builder.Configuration.GetValue("PasswordResetRateLimit:PermitLimit", 10),
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
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

// Create or update the tables automatically, so a new database (for example PYN's) works straight away.
// Only adds tables/columns, never deletes data. Switch off with Database__AutoMigrate=false.
if (app.Configuration.GetValue("Database:AutoMigrate", true))
{
    using var migrateScope = app.Services.CreateScope();
    var migrateDb = migrateScope.ServiceProvider.GetRequiredService<AppDbContext>();
    await DatabaseMigrator.ApplyPendingAsync(migrateDb, app.Logger);
}

// `dotnet run --project rest-server -- create-admin`: create the first Admin, then stop (no web server).
if (args.FirstOrDefault() == CreateAdminCommand.Name)
{
    using var commandScope = app.Services.CreateScope();
    var commandDb = commandScope.ServiceProvider.GetRequiredService<AppDbContext>();
    return await CreateAdminCommand.RunAsync(commandDb, postgresConnectionString, Console.In, Console.Out, CreateAdminCommand.ReadHidden);
}
if (isDesktop)
{
    // Electron owns the stdin pipe. EOF also stops the server if Electron crashes.
    _ = Task.Run(async () =>
    {
        await Console.In.ReadToEndAsync();
        app.Lifetime.StopApplication();
    });
}

// #53: placeholder event types for a new, empty database (every environment).
// The tables exist by now (automatic migrations above, unless switched off).
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

if (isDesktop)
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
    // Signal readiness only after seeding and binding the loopback listener succeeded.
    app.Lifetime.ApplicationStarted.Register(() =>
    {
        var addresses = app.Services.GetRequiredService<IServer>()
            .Features.Get<IServerAddressesFeature>()!.Addresses;
        File.WriteAllText(Environment.GetEnvironmentVariable("PANGAEA_DESKTOP_READY_FILE")!, addresses.Single());
    });
}
else
{
    app.UseHttpsRedirection();
}

app.UseAuthentication(); // 1. WHO are you?   (reads + checks the token)
app.UseAuthorization();  // 2. Are you ALLOWED? (checks [Authorize])
app.UseRateLimiter();    // 3. NEW: too many requests? (checks [EnableRateLimiting])

app.MapControllers();

app.Run();
return 0;

// Makes the auto-generated Program class visible to rest-server.Tests (WebApplicationFactory<Program>).
public partial class Program { }
