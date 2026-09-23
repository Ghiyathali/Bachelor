using Microsoft.EntityFrameworkCore;
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
var postgresConnectionString = builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException(
        "PostgreSQL is not configured. Set ConnectionStrings__Postgres in rest-server/.env.");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(postgresConnectionString));

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthorization();

app.MapControllers();

app.Run();
