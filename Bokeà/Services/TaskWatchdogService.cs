using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Bokea.Database;

namespace Bokea.Services;

public class TaskWatchdogService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TaskWatchdogService> _logger;

    public TaskWatchdogService(IServiceScopeFactory scopeFactory, ILogger<TaskWatchdogService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("TaskWatchdogService started.");

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RecalculateTaskStatesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred during task state recalculation.");
            }

            try
            {
                await timer.WaitForNextTickAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("TaskWatchdogService stopped.");
    }

    // How much slack past its due point a task gets before it is called late,
    // as a fraction of its own interval. Half again: long enough to cover a
    // bad day, short enough that a weekly thing does not drift into a month.
    private const double GraceRatio = 0.5;

    private async Task RecalculateTaskStatesAsync(CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var pushService = scope.ServiceProvider.GetRequiredService<PushNotificationService>();

        // Only load tasks that can experience time-based state transitions (skip unscheduled parked thoughts)
        var tasks = await dbContext.Tasks
            .Include(t => t.User)
            .Where(t => t.IntervalType == IntervalType.IntervalBased || t.IntervalType == IntervalType.Workdays || t.DueDateValue != null)
            .ToListAsync(stoppingToken);
        var currentTime = DateTime.UtcNow;
        bool hasChanges = false;
        var newlyEscalated = new List<TaskItem>();

        foreach (var task in tasks)
        {
            var newState = CalculateState(task, currentTime);
            if (task.State != newState)
            {
                _logger.LogInformation("Updating Task {TaskId} ('{Title}') state from {OldState} to {NewState}.",
                    task.Id, task.Title, task.State, newState);

                // Only notify when a task escalates into Amber/Red, not when it recovers to Green.
                if (newState == TaskState.Amber || newState == TaskState.Red)
                {
                    newlyEscalated.Add(task);
                }

                task.State = newState;
                hasChanges = true;
            }
        }

        if (hasChanges)
        {
            await dbContext.SaveChangesAsync(stoppingToken);
        }

        foreach (var task in newlyEscalated)
        {
            var title = task.State == TaskState.Red ? "Task overdue" : "Task needs attention soon";
            await pushService.NotifyUserAsync(task.UserId, title, task.Title, "/#tasks");
        }
    }

    public static TaskState CalculateState(TaskItem task, DateTime currentTime)
    {
        // Snooze override:
        // If SnoozedUntil is set and CurrentTime < SnoozedUntil, the state should be forced/overridden to Green.
        if (task.SnoozedUntil.HasValue && currentTime < task.SnoozedUntil.Value)
        {
            return TaskState.Green;
        }

        // Determine user local time from user's TimeZoneName if configured
        TimeZoneInfo userTz = TimeZoneInfo.Utc;
        if (!string.IsNullOrEmpty(task.User?.TimeZoneName))
        {
            try
            {
                userTz = TimeZoneInfo.FindSystemTimeZoneById(task.User.TimeZoneName);
            }
            catch
            {
                // Fallback to Utc if identifier unrecognized
            }
        }
        var userLocalTime = TimeZoneInfo.ConvertTimeFromUtc(currentTime, userTz);

        if (task.IntervalType == IntervalType.Workdays)
        {
            var userWorkDays = task.User?.WorkDays?.Split(',', StringSplitOptions.RemoveEmptyEntries)
                ?? new[] { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday" };
            var currentDayName = userLocalTime.DayOfWeek.ToString();

            // If today is NOT a workday, task is relaxed and safe (Green)
            if (!userWorkDays.Contains(currentDayName, StringComparer.OrdinalIgnoreCase))
            {
                return TaskState.Green;
            }

            // If already completed today in user's local time, it's Green
            if (task.LastCompletedAt.HasValue)
            {
                var lastCompLocal = TimeZoneInfo.ConvertTimeFromUtc(task.LastCompletedAt.Value, userTz);
                if (lastCompLocal.Date == userLocalTime.Date)
                {
                    return TaskState.Green;
                }
            }

            // On a workday: if past due time (if specified) or during the day
            if (!string.IsNullOrEmpty(task.DueTime) && TimeSpan.TryParse(task.DueTime, out var dueTimeSpan))
            {
                var dueToday = userLocalTime.Date.Add(dueTimeSpan);
                if (userLocalTime > dueToday)
                {
                    return task.IsCommitment ? TaskState.Red : TaskState.Amber;
                }
                else if ((dueToday - userLocalTime).TotalHours <= 2)
                {
                    return TaskState.Amber;
                }
                return TaskState.Green;
            }

            // Untimed workday task: relax to Green during work hours; escalate to Amber near/after workday end
            var workEndSpan = TimeSpan.FromHours(17);
            if (!string.IsNullOrEmpty(task.User?.WorkEndTime) && TimeSpan.TryParse(task.User.WorkEndTime, out var parsedEnd))
            {
                workEndSpan = parsedEnd;
            }
            var endOfWorkDay = userLocalTime.Date.Add(workEndSpan);

            if (userLocalTime >= endOfWorkDay)
            {
                return task.IsCommitment ? TaskState.Red : TaskState.Amber;
            }
            else if (userLocalTime >= endOfWorkDay.AddHours(-2))
            {
                return TaskState.Amber;
            }
            return TaskState.Green;
        }

        if (task.IntervalType == IntervalType.IntervalBased)
        {
            if (!task.IntervalDays.HasValue || task.IntervalDays.Value <= 0)
            {
                return TaskState.Green;
            }

            var anchorDate = task.LastCompletedAt ?? (task.DueDate.HasValue ? task.DueDate.Value.AddDays(-task.IntervalDays.Value) : task.CreatedAt);
            var elapsedTime = currentTime - anchorDate;

            var ratio = elapsedTime.TotalDays / task.IntervalDays.Value;

            // Amber when it comes due; red only once the grace band has gone
            // by as well, and then only for a hard commitment. A soft habit
            // ages to amber and waits there.
            if (ratio < 0.8)
            {
                return TaskState.Green;
            }
            if (ratio < 1.0 + GraceRatio)
            {
                return TaskState.Amber;
            }
            return task.IsCommitment ? TaskState.Red : TaskState.Amber;
        }
        else // FixedDate
        {
            // No date at all is a parked thought. It has never been scheduled,
            // so it cannot be late and it never carries a colour.
            if (!task.DueDate.HasValue)
            {
                return TaskState.Green;
            }

            // If task was completed on or after due date (in local date), keep it Green
            if (task.LastCompletedAt.HasValue)
            {
                var lastCompLocal = TimeZoneInfo.ConvertTimeFromUtc(task.LastCompletedAt.Value, userTz);
                if (lastCompLocal.Date >= task.DueDate.Value.Date)
                {
                    return TaskState.Green;
                }
            }

            var remainingTime = task.DueDate.Value - currentTime;
            
            if (remainingTime.TotalDays > 1)
            {
                return TaskState.Green;
            }
            if (remainingTime.TotalDays >= 0)
            {
                return TaskState.Amber;
            }
            return task.IsCommitment ? TaskState.Red : TaskState.Amber;
        }
    }
}
