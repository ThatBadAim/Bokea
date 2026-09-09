using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Bokea.Database;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Bokea.Endpoints
{
    public static class PushEndpoints
    {
        public static void MapPushEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/api/push");

            // GET /api/push/vapid-public-key - Public key needed by the browser to subscribe
            group.MapGet("/vapid-public-key", (IConfiguration config) =>
            {
                return Results.Ok(new { publicKey = config["Vapid:PublicKey"] });
            });

            // POST /api/push/subscribe - Register a browser push subscription for the current user
            group.MapPost("/subscribe", async (AppDbContext db, ClaimsPrincipal user, PushSubscriptionRequest request) =>
            {
                int userId = int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

                if (string.IsNullOrWhiteSpace(request.Endpoint) || request.Keys is null ||
                    string.IsNullOrWhiteSpace(request.Keys.P256dh) || string.IsNullOrWhiteSpace(request.Keys.Auth))
                {
                    return Results.BadRequest("A valid push subscription (endpoint and keys) is required.");
                }

                var existing = await db.PushSubscriptions.FirstOrDefaultAsync(s => s.Endpoint == request.Endpoint);
                if (existing != null)
                {
                    existing.UserId = userId;
                    existing.P256dh = request.Keys.P256dh;
                    existing.Auth = request.Keys.Auth;
                }
                else
                {
                    db.PushSubscriptions.Add(new PushSubscription
                    {
                        UserId = userId,
                        Endpoint = request.Endpoint,
                        P256dh = request.Keys.P256dh,
                        Auth = request.Keys.Auth
                    });
                }

                await db.SaveChangesAsync();
                return Results.Ok(new { success = true });
            }).RequireAuthorization();

            // POST /api/push/unsubscribe - Remove a browser push subscription
            group.MapPost("/unsubscribe", async (AppDbContext db, ClaimsPrincipal user, UnsubscribeRequest request) =>
            {
                int userId = int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
                var existing = await db.PushSubscriptions.FirstOrDefaultAsync(s => s.Endpoint == request.Endpoint && s.UserId == userId);
                if (existing != null)
                {
                    db.PushSubscriptions.Remove(existing);
                    await db.SaveChangesAsync();
                }
                return Results.Ok(new { success = true });
            }).RequireAuthorization();
        }
    }

    public record PushSubscriptionKeys(string P256dh, string Auth);
    public record PushSubscriptionRequest(string Endpoint, PushSubscriptionKeys? Keys);
    public record UnsubscribeRequest(string Endpoint);
}
