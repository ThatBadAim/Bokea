using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Bokea.Database;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Bokea.Endpoints
{
    public static class TaskEndpoints
    {
        public static void MapTaskEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/api/tasks").RequireAuthorization();

            // GET /api/tasks - Retrieve all tasks, optionally filtered by sector and/or state
            group.MapGet("/", async (AppDbContext db, ClaimsPrincipal user, string? sector, string? state) =>
            {
                int userId = int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
                IQueryable<TaskItem> query = db.Tasks.AsNoTracking().Where(t => t.UserId == userId);

                if (!string.IsNullOrEmpty(sector))
                {
                    if (Enum.TryParse<Sector>(sector, true, out var sectorEnum))
                    {
                        query = query.Where(t => t.Sector == sectorEnum);
                    }
                    else
                    {
                        return Results.BadRequest($"Invalid sector value: {sector}. Valid values are: {string.Join(", ", Enum.GetNames<Sector>())}");
                    }
                }

                if (!string.IsNullOrEmpty(state))
                {
                    if (Enum.TryParse<TaskState>(state, true, out var stateEnum))
                    {
                        query = query.Where(t => t.State == stateEnum);
                    }
                    else
                    {
                        return Results.BadRequest($"Invalid state value: {state}. Valid values are: {string.Join(", ", Enum.GetNames<TaskState>())}");
                    }
                }

                var tasks = await query.OrderBy(t => t.DisplayOrder).ThenByDescending(t => t.CreatedAt).ToListAsync();
                return Results.Ok(tasks);
            });

            // POST /api/tasks - Create a new task
            group.MapPost("/", async (AppDbContext db, ClaimsPrincipal user, CreateTaskRequest request) =>
            {
                int userId = int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

                if (string.IsNullOrWhiteSpace(request.Title))
                {
                    return Results.BadRequest("Title is required.");
                }

                if (!Enum.TryParse<Sector>(request.Sector, true, out var sectorEnum))
                {
                    return Results.BadRequest($"Invalid Sector. Valid values are: {string.Join(", ", Enum.GetNames<Sector>())}");
                }

                if (!Enum.TryParse<IntervalType>(request.IntervalType, true, out var intervalTypeEnum))
                {
                    return Results.BadRequest($"Invalid IntervalType. Valid values are: {string.Join(", ", Enum.GetNames<IntervalType>())}");
                }

                DueDateType dueDate;
                if (intervalTypeEnum == IntervalType.IntervalBased)
                {
                    if (!request.IntervalDays.HasValue || request.IntervalDays.Value <= 0)
                    {
                        return Results.BadRequest("IntervalDays must be greater than 0 for interval-based tasks.");
                    }
                    dueDate = DateTime.UtcNow.AddDays(request.IntervalDays.Value);
                }
                else // FixedDate
                {
                    // No date is a legitimate answer, not a validation error.
                    // A thought parked from the capture bar has not been
                    // scheduled yet, and dating it "today" on the way in is
                    // what turns an inbox into a pile of red.
                    dueDate = request.DueDate.HasValue
                        ? new DueDateType(request.DueDate.Value)
                        : DueDateType.Null;
                }

                var task = new TaskItem
                {
                    UserId = userId,
                    Title = request.Title.Trim(),
                    Description = request.Description?.Trim(),
                    Sector = sectorEnum,
                    IntervalType = intervalTypeEnum,
                    IntervalDays = intervalTypeEnum == IntervalType.IntervalBased ? request.IntervalDays : null,
                    DueDate = dueDate,
                    DueTime = WhenInTheDay.Time(request.DueTime),
                    TimeSlot = WhenInTheDay.Slot(request.TimeSlot) ?? "anytime",
                    DurationMinutes = WhenInTheDay.Duration(request.DurationMinutes),
                    IsCommitment = request.IsCommitment ?? false,
                    CreatedAt = DateTime.UtcNow,
                    State = TaskState.Green
                };

                db.Tasks.Add(task);
                await db.SaveChangesAsync();

                return Results.Created($"/api/tasks/{task.Id}", task);
            });

            // PUT /api/tasks/{id} - Edit an existing task
            group.MapPut("/{id}", async (AppDbContext db, ClaimsPrincipal user, int id, UpdateTaskRequest request) =>
            {
                int userId = int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
                var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
                if (task == null)
                {
                    return Results.NotFound();
                }

                if (string.IsNullOrWhiteSpace(request.Title))
                {
                    return Results.BadRequest("Title is required.");
                }

                if (!Enum.TryParse<Sector>(request.Sector, true, out var sectorEnum))
                {
                    return Results.BadRequest($"Invalid Sector. Valid values are: {string.Join(", ", Enum.GetNames<Sector>())}");
                }

                if (!Enum.TryParse<IntervalType>(request.IntervalType, true, out var intervalTypeEnum))
                {
                    return Results.BadRequest($"Invalid IntervalType. Valid values are: {string.Join(", ", Enum.GetNames<IntervalType>())}");
                }

                task.Title = request.Title.Trim();
                task.Description = request.Description?.Trim();
                task.Sector = sectorEnum;
                task.DueTime = WhenInTheDay.Time(request.DueTime);
                task.TimeSlot = WhenInTheDay.Slot(request.TimeSlot) ?? "anytime";
                task.DurationMinutes = WhenInTheDay.Duration(request.DurationMinutes);
                if (request.IsCommitment.HasValue) task.IsCommitment = request.IsCommitment.Value;

                if (intervalTypeEnum == IntervalType.IntervalBased)
                {
                    if (!request.IntervalDays.HasValue || request.IntervalDays.Value <= 0)
                    {
                        return Results.BadRequest("IntervalDays must be greater than 0 for interval-based tasks.");
                    }
                    task.IntervalType = intervalTypeEnum;
                    task.IntervalDays = request.IntervalDays.Value;

                    if (request.DueDate.HasValue)
                    {
                        task.DueDate = request.DueDate.Value;
                    }
                    else if (task.IntervalDays != request.IntervalDays.Value)
                    {
                        task.DueDate = (task.LastCompletedAt ?? task.CreatedAt).AddDays(request.IntervalDays.Value);
                    }
                }
                else // FixedDate
                {
                    task.IntervalType = intervalTypeEnum;
                    task.IntervalDays = null;
                    // As on create: an undated fixed task is a parked one.
                    task.DueDate = request.DueDate.HasValue
                        ? new DueDateType(request.DueDate.Value)
                        : DueDateType.Null;
                }

                await db.SaveChangesAsync();
                return Results.Ok(task);
            });

            // PUT /api/tasks/reorder - Reorder tasks
            group.MapPut("/reorder", async (AppDbContext db, ClaimsPrincipal user, System.Collections.Generic.List<ReorderTaskRequest> requests) =>
            {
                int userId = int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
                var taskIds = requests.Select(r => r.Id).ToList();
                var tasksToUpdate = await db.Tasks.Where(t => t.UserId == userId && taskIds.Contains(t.Id)).ToListAsync();

                foreach (var req in requests)
                {
                    var task = tasksToUpdate.FirstOrDefault(t => t.Id == req.Id);
                    if (task != null)
                    {
                        task.DisplayOrder = req.Order;
                        if (!string.IsNullOrEmpty(req.Sector) && Enum.TryParse<Sector>(req.Sector, true, out var sectorEnum))
                        {
                            task.Sector = sectorEnum;
                        }
                    }
                }

                await db.SaveChangesAsync();
                return Results.NoContent();
            });

            // DELETE /api/tasks/{id} - Delete a task
            group.MapDelete("/{id}", async (AppDbContext db, ClaimsPrincipal user, int id) =>
            {
                int userId = int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
                var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
                if (task == null)
                {
                    return Results.NotFound();
                }

                db.Tasks.Remove(task);
                await db.SaveChangesAsync();
                return Results.NoContent();
            });

            // POST /api/tasks/{id}/complete - Complete a task
            group.MapPost("/{id}/complete", async (AppDbContext db, ClaimsPrincipal user, int id, HttpContext httpContext) =>
            {
                int userId = int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
                string? notes = null;
                if (httpContext.Request.HasJsonContentType())
                {
                    try
                    {
                        var request = await httpContext.Request.ReadFromJsonAsync<CompleteTaskRequest>();
                        notes = request?.Notes;
                    }
                    catch
                    {
                        // Ignore JSON parsing errors and fallback to null notes
                    }
                }

                using var transaction = await db.Database.BeginTransactionAsync();
                try
                {
                    var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
                    if (task == null)
                    {
                        return Results.NotFound();
                    }

                    task.LastCompletedAt = DateTime.UtcNow;
                    task.SnoozedUntil = null;
                    task.State = TaskState.Green;

                    if (task.IntervalType == IntervalType.IntervalBased)
                    {
                        int days = task.IntervalDays ?? 1;
                        task.DueDate = DateTime.UtcNow.AddDays(days);
                    }

                    var log = new TaskCompletionLog
                    {
                        TaskId = task.Id,
                        CompletedAt = DateTime.UtcNow,
                        Notes = notes
                    };

                    db.TaskCompletionLogs.Add(log);
                    await db.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Results.Ok(task);
                }
                catch (Exception)
                {
                    await transaction.RollbackAsync();
                    return Results.Problem("An error occurred while completing the task.");
                }
            });

            // DELETE /api/tasks/{id}/complete - Undo the most recent completion.
            // Mis-tapping the tick is the commonest input error this app has to
            // survive, so completing has to be walkable-back: drop the newest
            // log, then rebuild LastCompletedAt and DueDate from whatever
            // history is actually left rather than guessing at them.
            group.MapDelete("/{id}/complete", async (AppDbContext db, ClaimsPrincipal user, int id) =>
            {
                int userId = int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

                using var transaction = await db.Database.BeginTransactionAsync();
                try
                {
                    var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
                    if (task == null)
                    {
                        return Results.NotFound();
                    }

                    var newest = await db.TaskCompletionLogs
                        .Where(l => l.TaskId == task.Id)
                        .OrderByDescending(l => l.CompletedAt)
                        .FirstOrDefaultAsync();

                    if (newest != null)
                    {
                        db.TaskCompletionLogs.Remove(newest);
                        await db.SaveChangesAsync();
                    }

                    var previous = await db.TaskCompletionLogs
                        .Where(l => l.TaskId == task.Id)
                        .OrderByDescending(l => l.CompletedAt)
                        .FirstOrDefaultAsync();

                    task.LastCompletedAt = previous?.CompletedAt;

                    if (task.IntervalType == IntervalType.IntervalBased)
                    {
                        int days = task.IntervalDays ?? 1;
                        task.DueDate = (task.LastCompletedAt ?? task.CreatedAt).AddDays(days);
                    }

                    await db.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Results.Ok(task);
                }
                catch (Exception)
                {
                    await transaction.RollbackAsync();
                    return Results.Problem("An error occurred while undoing the completion.");
                }
            });

            // POST /api/tasks/{id}/snooze - Snooze warning
            group.MapPost("/{id}/snooze", async (AppDbContext db, ClaimsPrincipal user, int id, HttpContext httpContext) =>
            {
                int userId = int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
                int durationHours = 24;
                if (httpContext.Request.HasJsonContentType())
                {
                    try
                    {
                        var request = await httpContext.Request.ReadFromJsonAsync<SnoozeTaskRequest>();
                        // Zero is not a missing value: it is how undoing a
                        // snooze asks for the snooze to be cleared.
                        if (request?.DurationHours.HasValue == true && request.DurationHours.Value >= 0)
                        {
                            durationHours = request.DurationHours.Value;
                        }
                    }
                    catch
                    {
                        // Ignore JSON parsing errors and fallback to 24 hours
                    }
                }

                using var transaction = await db.Database.BeginTransactionAsync();
                try
                {
                    var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
                    if (task == null)
                    {
                        return Results.NotFound();
                    }

                    task.SnoozedUntil = durationHours <= 0
                        ? null
                        : DateTime.UtcNow.AddHours(durationHours);
                    if (durationHours > 0) task.State = TaskState.Green;

                    await db.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Results.Ok(task);
                }
                catch (Exception)
                {
                    await transaction.RollbackAsync();
                    return Results.Problem("An error occurred while snoozing the task.");
                }
            });

            // GET /api/history & GET /api/tasks/history - Retrieve compliance history
            var historyHandler = async (AppDbContext db, ClaimsPrincipal user) =>
            {
                int userId = int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
                var now = DateTime.UtcNow;
                var historyList = new System.Collections.Generic.List<object>();

                // Get tasks and logs in memory to calculate analytics for the user (read-only)
                var allTasks = await db.Tasks.AsNoTracking().Where(t => t.UserId == userId).ToListAsync();
                var taskIds = allTasks.Select(t => t.Id).ToList();
                var allLogs = await db.TaskCompletionLogs.AsNoTracking().Where(l => taskIds.Contains(l.TaskId)).ToListAsync();

                // Group completions once by Date for O(1) dictionary lookups instead of scanning all logs 30 times
                var completionsByDate = allLogs
                    .GroupBy(l => l.CompletedAt.Date)
                    .ToDictionary(g => g.Key, g => g.Count());

                for (int i = 29; i >= 0; i--)
                {
                    var targetDate = now.AddDays(-i).Date;
                    var dateStr = targetDate.ToString("yyyy-MM-dd");

                    // Count completions on this day (UTC) in O(1)
                    int completed = completionsByDate.GetValueOrDefault(targetDate, 0);

                    // Compute expected due tasks active on this day
                    double expectedDue = 0;
                    var activeTasks = allTasks.Where(t => t.CreatedAt.Date <= targetDate);

                    foreach (var task in activeTasks)
                    {
                        if (task.IntervalType == IntervalType.IntervalBased)
                        {
                            int days = task.IntervalDays ?? 1;
                            expectedDue += 1.0 / days;
                        }
                        else if (task.DueDate.HasValue && task.DueDate.Value.Date == targetDate)
                        {
                            expectedDue += 1.0;
                        }
                    }

                    int total = (int)Math.Round(expectedDue);
                    if (total < completed) total = completed;
                    if (total == 0) total = 1; // prevent division by zero

                    int rate = (int)Math.Round((double)completed / total * 100);
                    if (rate > 100) rate = 100;

                    historyList.Add(new
                    {
                        date = dateStr,
                        completed = completed,
                        total = total,
                        rate = rate
                    });
                }

                return Results.Ok(historyList);
            };

            app.MapGet("/api/history", historyHandler).RequireAuthorization();
            group.MapGet("/history", historyHandler);
        }
    }

    /// <summary>
    /// Cleans up the three "when in the day" fields coming off the wire.
    /// </summary>
    /// <remarks>
    /// These are rejected quietly rather than with a 400. A mistyped time is
    /// not a reason to refuse to save somebody's task; dropping the bad part
    /// and keeping the task loses less than throwing the whole thing back.
    /// </remarks>
    internal static class WhenInTheDay
    {
        private static readonly string[] Slots = { "morning", "afternoon", "evening", "anytime" };

        public static string? Time(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            return TimeSpan.TryParseExact(value.Trim(), new[] { @"h\:mm", @"hh\:mm" },
                       System.Globalization.CultureInfo.InvariantCulture, out var parsed)
                ? parsed.ToString(@"hh\:mm")
                : null;
        }

        public static string? Slot(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            var slot = value.Trim().ToLowerInvariant();
            return Array.IndexOf(Slots, slot) >= 0 ? slot : null;
        }

        // Eight hours is the ceiling. Anything longer is a project, and a
        // project laid across a day timeline swallows the whole day.
        public static int? Duration(int? value)
        {
            if (!value.HasValue) return null;
            if (value.Value < 1 || value.Value > 480) return null;
            return value.Value;
        }
    }

    // Request DTOs
    // DueTime, TimeSlot and DurationMinutes are optional on both: a task with
    // no answer to "when in the day" is a normal thing to have, and the client
    // treats a missing slot as "any time".
    public record CreateTaskRequest(
        string Title,
        string? Description,
        string Sector,
        string IntervalType,
        int? IntervalDays,
        DateTime? DueDate,
        string? DueTime = null,
        string? TimeSlot = null,
        int? DurationMinutes = null,
        bool? IsCommitment = null
    );

    public record UpdateTaskRequest(
        string Title,
        string? Description,
        string Sector,
        string IntervalType,
        int? IntervalDays,
        DateTime? DueDate,
        string? DueTime = null,
        string? TimeSlot = null,
        int? DurationMinutes = null,
        bool? IsCommitment = null
    );

    public record CompleteTaskRequest(
        string? Notes
    );

    public record SnoozeTaskRequest(
        int? DurationHours
    );

    public record ReorderTaskRequest(
        int Id,
        int Order,
        string? Sector
    );
}
