using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using System.Security.Claims;
using Bokea.Services;

namespace Bokea.Endpoints
{
    public static class DigestEndpoints
    {
        public static void MapDigestEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/api/digest").RequireAuthorization();

            group.MapGet("/", async (DigestService digestService, System.Security.Claims.ClaimsPrincipal user) =>
            {
                int userId = int.Parse(user.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier) ?? "0");
                var digest = await digestService.GetMorningDigestAsync(userId);
                return Results.Ok(digest);
            });
        }
    }
}
