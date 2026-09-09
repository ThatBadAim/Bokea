using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bokea.Database;

namespace Bokea.Services
{
    public class DigestService
    {
        private readonly AppDbContext _context;

        public DigestService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<MorningDigestModel> GetMorningDigestAsync(int userId)
        {
            var warningTasks = await _context.Tasks
                .AsNoTracking()
                .Where(t => t.UserId == userId && (t.State == TaskState.Amber || t.State == TaskState.Red))
                .OrderBy(t => t.Sector)
                .ThenBy(t => t.DueDateValue)
                .ToListAsync();

            var digest = new MorningDigestModel
            {
                TotalWarningTasks = warningTasks.Count
            };

            var now = DateTime.UtcNow;

            foreach (var task in warningTasks)
            {
                var sectorStr = GetSectorDisplayName(task.Sector);
                if (!digest.TasksBySector.ContainsKey(sectorStr))
                {
                    digest.TasksBySector[sectorStr] = new List<DigestTaskDto>();
                }

                digest.TasksBySector[sectorStr].Add(new DigestTaskDto
                {
                    Id = task.Id,
                    Title = task.Title,
                    Description = task.Description,
                    Sector = sectorStr,
                    State = task.State.ToString(),
                    DueDate = task.DueDate?.ToString("yyyy-MM-dd") ?? string.Empty
                });

                var recommendation = GenerateRecommendation(task, now);
                digest.RecommendedActions.Add(recommendation);
            }

            return digest;
        }

        private string GetSectorDisplayName(Sector sector)
        {
            return sector switch
            {
                Sector.HealthAndVitality => "Health & Vitality",
                Sector.CareerAndFinance => "Career & Finance",
                Sector.RelationshipsAndSocial => "Relationships & Social",
                Sector.MindAndEnvironment => "Mind & Environment",
                _ => sector.ToString()
            };
        }

        private string GenerateRecommendation(TaskItem item, DateTime now)
        {
            var dueDate = item.DueDate;
            if (item.IntervalType == IntervalType.IntervalBased && (dueDate == null || !dueDate.HasValue))
            {
                dueDate = (item.LastCompletedAt ?? item.CreatedAt).AddDays(item.IntervalDays ?? 0);
            }

            if (dueDate.HasValue)
            {
                if (now.Date > dueDate.Value.Date)
                {
                    var overdueDays = (int)(now.Date - dueDate.Value.Date).TotalDays;
                    var dayWord = overdueDays == 1 ? "day" : "days";
                    return $"{item.Title} - overdue by {overdueDays} {dayWord}. Complete or Snooze?";
                }
                else
                {
                    var remainingDays = (int)(dueDate.Value.Date - now.Date).TotalDays;
                    if (remainingDays == 0)
                    {
                        return $"{item.Title} - due today. Complete or Snooze?";
                    }
                    else
                    {
                        var dayWord = remainingDays == 1 ? "day" : "days";
                        return $"{item.Title} - due in {remainingDays} {dayWord}. Complete or Snooze?";
                    }
                }
            }

            return $"{item.Title} - requires attention. Complete or Snooze?";
        }
    }

    public class MorningDigestModel
    {
        public int TotalWarningTasks { get; set; }
        public Dictionary<string, List<DigestTaskDto>> TasksBySector { get; set; } = new();
        public List<string> RecommendedActions { get; set; } = new();
    }

    public class DigestTaskDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Sector { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty; // "Amber" or "Red"
        public string DueDate { get; set; } = string.Empty;
    }
}
