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

// Fallback to index.html for client-side SPA routing (e.g. /tasks, /calendar, /settings)
app.MapFallbackToFile("index.html");

app.Run();
