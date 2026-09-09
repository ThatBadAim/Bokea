using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Bokea.Database
{
    public class AppDbContext : DbContext
    {
        public AppDbContext()
        {
        }

        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        public DbSet<TaskItem> Tasks { get; set; } = null!;
        public DbSet<TaskCompletionLog> TaskCompletionLogs { get; set; } = null!;
        public DbSet<User> Users { get; set; } = null!;
        public DbSet<PushSubscription> PushSubscriptions { get; set; } = null!;

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            if (!optionsBuilder.IsConfigured)
            {
                // Default connection string if not configured via DI (e.g. during migrations/tests or local run)
                optionsBuilder.UseSqlite("Data Source=Bokea.db");
            }
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure enums as strings in SQLite
            modelBuilder.Entity<TaskItem>()
                .Property(t => t.Sector)
                .HasConversion<string>();

            modelBuilder.Entity<TaskItem>()
                .Property(t => t.IntervalType)
                .HasConversion<string>();

            modelBuilder.Entity<TaskItem>()
                .Property(t => t.State)
                .HasConversion<string>();

            // Configure DueDate converter.
            //
            // DueDateType has always had a Null sentinel and the converter has
            // always mapped it to a null column value, but the property itself
            // is a non-nullable reference type, so EF inferred the column as
            // NOT NULL and a task with no date could not be saved. A task with
            // no date is exactly what a parked thought is, so the column has to
            // allow it. See RelaxDueDateNullability for existing databases.
            modelBuilder.Entity<TaskItem>().Ignore(t => t.DueDate);
            modelBuilder.Entity<TaskItem>()
                .Property(t => t.DueDateValue)
                .HasColumnName("DueDate")
                .IsRequired(false);

            // Configure User-Task relationship
            modelBuilder.Entity<TaskItem>()
                .HasOne(t => t.User)
                .WithMany(u => u.Tasks)
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Configure Database Indexes
            modelBuilder.Entity<TaskItem>().HasIndex(t => t.UserId);
            modelBuilder.Entity<TaskItem>().HasIndex(t => t.State);
            modelBuilder.Entity<TaskItem>().HasIndex(t => t.Sector);
            modelBuilder.Entity<TaskCompletionLog>().HasIndex(l => l.TaskId);
            modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique();

            // Configure User-PushSubscription relationship
            modelBuilder.Entity<PushSubscription>()
                .HasOne(p => p.User)
                .WithMany()
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<PushSubscription>().HasIndex(p => p.UserId);
            modelBuilder.Entity<PushSubscription>().HasIndex(p => p.Endpoint).IsUnique();

            // No seed data.
            //
            // This context used to ship a "Test User" plus twelve tasks and a
            // set of completion logs, all of which landed in the database the
            // first time it was created. Anyone running the app then found an
            // account full of someone else's dentist appointments and budget
            // reviews. A new database is now empty, and a new user's account
            // contains only what they put in it.
            //
            // Demo data for local development is available behind a flag - see
            // DbInitializer.Initialize and the Seed:Demo setting.
        }
    }

    public static class DbInitializer
    {
        /// <summary>
        /// Creates the database if it is missing. It does not put anything in it.
        /// </summary>
        /// <remarks>
        /// This used to insert a test account with a fixed password, twelve
        /// tasks and thirty days of invented completion logs, every time the
        /// app started. That data belonged to nobody and turned up in every
        /// fresh install, so it is gone. Pass seedDemoData: true (wired to the
        /// "Seed:Demo" configuration flag, off by default and intended for
        /// local development only) if you want a populated database to look at.
        /// </remarks>
        public static void Initialize(AppDbContext context, bool seedDemoData = false)
        {
            context.Database.EnsureCreated();
            AddMissingColumns(context);
            RelaxDueDateNullability(context);

            if (!seedDemoData)
            {
                return;
            }

            if (context.Users.Any())
            {
                return;
            }

            var now = DateTime.UtcNow;

            var demoUser = new User
            {
                Email = "demo@example.invalid",
                FirstName = "Demo",
                // Password: "demo-password-not-for-production"
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("demo-password-not-for-production"),
                CreatedAt = now.AddDays(-30),
                IsSetupCompleted = true,
                WakeUpTime = "07:00",
                BedTime = "23:00",
                WorkStartTime = "09:00",
                WorkEndTime = "17:00",
                WorkDays = "Monday,Tuesday,Wednesday,Thursday,Friday"
            };
            context.Users.Add(demoUser);
            context.SaveChanges();

            context.Tasks.AddRange(
                new TaskItem
                {
                    UserId = demoUser.Id,
                    Title = "Morning walk",
                    Description = "Demo data.",
                    Sector = Sector.HealthAndVitality,
                    IntervalType = IntervalType.IntervalBased,
                    IntervalDays = 1,
                    DueDate = now.AddDays(1),
                    LastCompletedAt = now.AddHours(-4),
                    CreatedAt = now.AddDays(-10),
                    State = TaskState.Green
                },
                new TaskItem
                {
                    UserId = demoUser.Id,
                    Title = "Weekly budget review",
                    Description = "Demo data.",
                    Sector = Sector.CareerAndFinance,
                    IntervalType = IntervalType.IntervalBased,
                    IntervalDays = 7,
                    DueDate = now.AddDays(-1),
                    LastCompletedAt = now.AddDays(-14),
                    CreatedAt = now.AddDays(-20),
                    State = TaskState.Red
                },
                new TaskItem
                {
                    UserId = demoUser.Id,
                    Title = "Call home",
                    Description = "Demo data.",
                    Sector = Sector.RelationshipsAndSocial,
                    IntervalType = IntervalType.IntervalBased,
                    IntervalDays = 7,
                    DueDate = now.AddHours(2),
                    LastCompletedAt = now.AddDays(-7),
                    CreatedAt = now.AddDays(-15),
                    State = TaskState.Amber
                }
            );

            context.SaveChanges();
        }

        /// <summary>
        /// Drops the NOT NULL constraint on Tasks.DueDate for databases built
        /// before undated tasks existed.
        /// </summary>
        /// <remarks>
        /// SQLite cannot alter a column's nullability in place, so this is the
        /// standard rebuild: make the new table, copy the rows across, swap the
        /// names, put the indexes back. It is skipped entirely once the column
        /// already allows nulls, which is the case for any database created
        /// after this change, so the normal path costs one PRAGMA.
        /// </remarks>
        private static void RelaxDueDateNullability(AppDbContext context)
        {
            var connection = context.Database.GetDbConnection();
            var wasClosed = connection.State != System.Data.ConnectionState.Open;
            if (wasClosed) connection.Open();

            try
            {
                var notNull = false;
                var found = false;
                using (var read = connection.CreateCommand())
                {
                    read.CommandText = "PRAGMA table_info(Tasks);";
                    using var reader = read.ExecuteReader();
                    while (reader.Read())
                    {
                        if (!string.Equals(reader.GetString(1), "DueDate", StringComparison.OrdinalIgnoreCase)) continue;
                        found = true;
                        notNull = reader.GetInt32(3) == 1;
                        break;
                    }
                }

                if (!found || !notNull) return;

                var columns = new List<string>();
                using (var read = connection.CreateCommand())
                {
                    read.CommandText = "PRAGMA table_info(Tasks);";
                    using var reader = read.ExecuteReader();
                    while (reader.Read()) columns.Add(reader.GetString(1));
                }

                var columnList = string.Join(", ", columns.Select(c => $"\"{c}\""));

                using var tx = connection.BeginTransaction();
                void Run(string sql)
                {
                    using var cmd = connection.CreateCommand();
                    cmd.Transaction = tx;
                    cmd.CommandText = sql;
                    cmd.ExecuteNonQuery();
                }

                Run(@"CREATE TABLE ""Tasks_rebuild"" (
                        ""Id"" INTEGER NOT NULL CONSTRAINT ""PK_Tasks_rebuild"" PRIMARY KEY AUTOINCREMENT,
                        ""UserId"" INTEGER NOT NULL,
                        ""Title"" TEXT NOT NULL,
                        ""Description"" TEXT NULL,
                        ""Sector"" TEXT NOT NULL,
                        ""IntervalType"" TEXT NOT NULL,
                        ""IntervalDays"" INTEGER NULL,
                        ""DueDate"" TEXT NULL,
                        ""DueTime"" TEXT NULL,
                        ""TimeSlot"" TEXT NULL,
                        ""DurationMinutes"" INTEGER NULL,
                        ""IsCommitment"" INTEGER NOT NULL DEFAULT 0,
                        ""LastCompletedAt"" TEXT NULL,
                        ""CreatedAt"" TEXT NOT NULL,
                        ""SnoozedUntil"" TEXT NULL,
                        ""State"" TEXT NOT NULL,
                        ""DisplayOrder"" INTEGER NOT NULL,
                        CONSTRAINT ""FK_Tasks_Users_UserId"" FOREIGN KEY (""UserId"")
                            REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                      );");

                Run($"INSERT INTO \"Tasks_rebuild\" ({columnList}) SELECT {columnList} FROM \"Tasks\";");
                Run("DROP TABLE \"Tasks\";");
                Run("ALTER TABLE \"Tasks_rebuild\" RENAME TO \"Tasks\";");
                Run("CREATE INDEX IF NOT EXISTS \"IX_Tasks_UserId\" ON \"Tasks\" (\"UserId\");");
                Run("CREATE INDEX IF NOT EXISTS \"IX_Tasks_State\" ON \"Tasks\" (\"State\");");
                Run("CREATE INDEX IF NOT EXISTS \"IX_Tasks_Sector\" ON \"Tasks\" (\"Sector\");");

                tx.Commit();
            }
            catch (Exception ex)
            {
                // A failed rebuild must not stop the app booting: the worst case
                // is that undated tasks stay unavailable until it is looked at.
                Console.Error.WriteLine($"Could not relax Tasks.DueDate nullability: {ex.Message}");
            }
            finally
            {
                if (wasClosed) connection.Close();
            }
        }

        /// <summary>
        /// Adds columns that were introduced after a database was first created.
        /// </summary>
        /// <remarks>
        /// EnsureCreated builds the schema once and never looks at it again, and
        /// this project has no migrations. Without this, adding a property to a
        /// model leaves every existing install throwing "no such column" on the
        /// first query - the person loses their account to a feature they never
        /// asked for. Each statement is additive and safe to run repeatedly.
        /// </remarks>
        private static void AddMissingColumns(AppDbContext context)
        {
            // Constraint is what follows the type. Everything optional is plain
            // NULL; a column backing a non-nullable property has to arrive with
            // a default, or every row that already exists reads back as NULL
            // and EF throws "data is NULL at ordinal N" on the next query.
            var columns = new (string Table, string Column, string Type, string Constraint)[]
            {
                ("Users", "DisplayName", "TEXT", "NULL"),
                ("Users", "Pronouns", "TEXT", "NULL"),
                ("Users", "DateOfBirth", "TEXT", "NULL"),
                ("Users", "Gender", "TEXT", "NULL"),
                ("Users", "Bio", "TEXT", "NULL"),
                ("Users", "Country", "TEXT", "NULL"),
                ("Users", "City", "TEXT", "NULL"),
                ("Users", "TimeZoneName", "TEXT", "NULL"),
                ("Users", "PhoneNumber", "TEXT", "NULL"),
                ("Users", "AvatarDataUrl", "TEXT", "NULL"),
                ("Tasks", "DueTime", "TEXT", "NULL"),
                ("Tasks", "TimeSlot", "TEXT", "NULL"),
                ("Tasks", "DurationMinutes", "INTEGER", "NULL"),
                ("Tasks", "IsCommitment", "INTEGER", "NOT NULL DEFAULT 0")
            };

            var connection = context.Database.GetDbConnection();
            var wasClosed = connection.State != System.Data.ConnectionState.Open;
            if (wasClosed) connection.Open();

            try
            {
                foreach (var group in columns.GroupBy(c => c.Table))
                {
                    var existing = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    using (var read = connection.CreateCommand())
                    {
                        read.CommandText = $"PRAGMA table_info({group.Key});";
                        using var reader = read.ExecuteReader();
                        while (reader.Read()) existing.Add(reader.GetString(1));
                    }

                    // No table yet means a brand new database, which EnsureCreated
                    // has already built to the current shape.
                    if (existing.Count == 0) continue;

                    foreach (var column in group)
                    {
                        if (existing.Contains(column.Column)) continue;
                        using var alter = connection.CreateCommand();
                        alter.CommandText = $"ALTER TABLE {column.Table} ADD COLUMN {column.Column} {column.Type} {column.Constraint};";
                        alter.ExecuteNonQuery();
                    }
                }

                // Repair pass for any install that received a non-nullable
                // column before it carried its default. Harmless once clean.
                using (var fix = connection.CreateCommand())
                {
                    fix.CommandText = "UPDATE Tasks SET IsCommitment = 0 WHERE IsCommitment IS NULL;";
                    try { fix.ExecuteNonQuery(); } catch { /* column not there yet */ }
                }
            }
            finally
            {
                if (wasClosed) connection.Close();
            }
        }
    }
}