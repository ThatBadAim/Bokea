using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Bokea.Database;
using WebPush;

namespace Bokea.Services;

public class PushNotificationService
{
    private readonly AppDbContext _db;
    private readonly ILogger<PushNotificationService> _logger;
    private readonly VapidDetails _vapidDetails;

    public PushNotificationService(AppDbContext db, IConfiguration config, ILogger<PushNotificationService> logger)
    {
        _db = db;
        _logger = logger;

        var publicKey = config["Vapid:PublicKey"] ?? throw new InvalidOperationException("Vapid:PublicKey is not configured.");
        var privateKey = config["Vapid:PrivateKey"] ?? throw new InvalidOperationException("Vapid:PrivateKey is not configured.");
        var subject = config["Vapid:Subject"] ?? "mailto:notifications@bokea.app";

        _vapidDetails = new VapidDetails(subject, publicKey, privateKey);
    }

    public async Task NotifyUserAsync(int userId, string title, string body, string? url = null)
    {
        var subscriptions = await _db.PushSubscriptions.Where(s => s.UserId == userId).ToListAsync();
        if (subscriptions.Count == 0) return;

        var payload = System.Text.Json.JsonSerializer.Serialize(new { title, body, url = url ?? "/" });
        var client = new WebPushClient();

        foreach (var sub in subscriptions)
        {
            var pushSubscription = new WebPush.PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth);
            try
            {
                await client.SendNotificationAsync(pushSubscription, payload, _vapidDetails);
            }
            catch (WebPushException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound || ex.StatusCode == System.Net.HttpStatusCode.Gone)
            {
                // Subscription is no longer valid on the browser's push service - remove it.
                _db.PushSubscriptions.Remove(sub);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send push notification to subscription {Id}.", sub.Id);
            }
        }

        await _db.SaveChangesAsync();
    }
}
