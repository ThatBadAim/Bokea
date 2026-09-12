using Microsoft.EntityFrameworkCore;
using Bokea.Database;
using Bokea.Services;
using Bokea.Endpoints;

using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Configure JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? "SuperSecretBokeaKeyThatNeedsToBeLongEnoughForHS256!!!123456";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });
builder.Services.AddAuthorization();

// Register AppDbContext with SQLite provider
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=Bokea.db"));

// Register DigestService
builder.Services.AddScoped<DigestService>();

// Register Push Notification Service (Web Push / VAPID)
builder.Services.AddScoped<PushNotificationService>();

// Register Background Watchdog Hosted Service
builder.Services.AddHostedService<TaskWatchdogService>();

var app = builder.Build();

// Create the SQLite database on startup if it is missing.
//
// Demo data is opt-in: set "Seed:Demo" to true (appsettings.Development.json or
// the Seed__Demo environment variable) when you want a populated database to
// develop against. It stays off everywhere else, so a real deployment never
// invents an account or a task that nobody created.
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var seedDemo = builder.Configuration.GetValue<bool>("Seed:Demo");
    DbInitializer.Initialize(context, seedDemo);
}

// Enable serving index.html and static assets from wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

// Register minimal API endpoint routes
app.MapAuthEndpoints();
app.MapTaskEndpoints();
app.MapDigestEndpoints();
app.MapPushEndpoints();

// Fallback for anything not handled above. Known SPA routes (the same ones
// js/app.js's client-side router recognises) get index.html so deep links
// like /tasks or /calendar still load the app at the right tab. Anything
// else is a genuinely bad URL, so it gets a real 404 — this used to fall
// through to index.html too, which silently loaded the Today screen with
// no sign anything was wrong.
var knownSpaRoutes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    "/", "/today", "/home", "/tasks", "/everything",
    "/patterns", "/analytics", "/calendar", "/profile", "/settings"
};

app.MapFallback(async context =>
{
    var path = context.Request.Path.Value ?? "/";
    var webRoot = app.Environment.WebRootPath;

    if (knownSpaRoutes.Contains(path))
    {
        context.Response.ContentType = "text/html";
        await context.Response.SendFileAsync(Path.Combine(webRoot, "index.html"));
        return;
    }

    context.Response.StatusCode = StatusCodes.Status404NotFound;
    context.Response.ContentType = "text/html";
    await context.Response.SendFileAsync(Path.Combine(webRoot, "404.html"));
});

app.Run();
