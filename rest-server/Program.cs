using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using RestServer.Auth;
using RestServer.Data;

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
builder.Services.AddAuthorization();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthentication(); // 1. WHO are you?   (reads + checks the token)
app.UseAuthorization();  // 2. Are you ALLOWED? (checks [Authorize])

app.MapControllers();

app.Run();
