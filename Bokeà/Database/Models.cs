using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Bokea.Database
{
    public enum Sector
    {
        HealthAndVitality,
        CareerAndFinance,
        RelationshipsAndSocial,
        MindAndEnvironment
    }

    public enum IntervalType
    {
        IntervalBased,
        FixedDate
    }

    public enum TaskState
    {
        Green,
        Amber,
        Red
    }

    [JsonConverter(typeof(DueDateTypeJsonConverter))]
    public class DueDateType : IEquatable<DueDateType>
    {
        public DateTime Value { get; }
        public bool HasValue { get; }

        public DueDateType(DateTime value)
        {
            Value = value;
            HasValue = true;
        }

        private DueDateType()
        {
            HasValue = false;
        }

        public static readonly DueDateType Null = new DueDateType();

        public static implicit operator DueDateType(DateTime dt) => new DueDateType(dt);
        public static implicit operator DateTime(DueDateType d) => d.HasValue ? d.Value : throw new InvalidOperationException("Nullable object must have a value.");

        public static TimeSpan operator -(DueDateType left, DateTime right)
        {
            if (left == null || !left.HasValue) return TimeSpan.Zero;
            return left.Value - right;
        }

        public static bool operator ==(DueDateType? left, DueDateType? right)
        {
            if (ReferenceEquals(left, right)) return true;
            if (left is null || !left.HasValue) return right is null || !right.HasValue;
            if (right is null || !right.HasValue) return false;
            return left.Value.Equals(right.Value);
        }

        public static bool operator !=(DueDateType? left, DueDateType? right) => !(left == right);

        public bool Equals(DueDateType? other)
        {
            if (other is null) return !HasValue;
            if (!HasValue && !other.HasValue) return true;
            if (HasValue && other.HasValue) return Value.Equals(other.Value);
            return false;
        }

        public override bool Equals(object? obj)
        {
            if (obj is DueDateType other) return Equals(other);
            if (obj is DateTime dt && HasValue) return Value.Equals(dt);
            return false;
        }

        public override int GetHashCode()
        {
            return HasValue ? Value.GetHashCode() : 0;
        }

        public override string ToString()
        {
            return HasValue ? Value.ToString("o") : string.Empty;
        }

        public string ToString(string format)
        {
            return HasValue ? Value.ToString(format) : string.Empty;
        }
    }

    public class DueDateTypeJsonConverter : JsonConverter<DueDateType>
    {
        public override DueDateType Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Null)
            {
                return DueDateType.Null;
            }

            if (reader.TokenType == JsonTokenType.String && DateTime.TryParse(reader.GetString(), out var dt))
            {
                return new DueDateType(dt);
            }

            if (reader.TokenType == JsonTokenType.StartObject)
            {
                // In case an object is passed
                using var doc = JsonDocument.ParseValue(ref reader);
                if (doc.RootElement.TryGetProperty("value", out var valProp) && DateTime.TryParse(valProp.GetString(), out var dateVal))
                {
                    return new DueDateType(dateVal);
                }
            }

            return DueDateType.Null;
        }

        public override void Write(Utf8JsonWriter writer, DueDateType value, JsonSerializerOptions options)
        {
            if (value == null || !value.HasValue)
            {
                writer.WriteNullValue();
            }
            else
            {
                writer.WriteStringValue(value.Value.ToString("yyyy-MM-ddTHH:mm:ssZ"));
            }
        }
    }

    public class User
    {
        public int Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Wake up & Sleep Times
        public string? WakeUpTime { get; set; }
        public string? BedTime { get; set; }

        // Work Schedule Details
        public string? WorkStartTime { get; set; }
        public string? WorkEndTime { get; set; }
        public string? WorkDays { get; set; } // Comma-separated list of weekdays (e.g. "Monday,Tuesday")

        public bool IsSetupCompleted { get; set; } = false;

        // ---- Profile ----
        //
        // Everything below is optional and stays optional. A person can use
        // this app having told it nothing but a first name; these fields exist
        // because a platform is expected to let you say who you are, not
        // because anything here is required to make the app work.
        //
        // Nothing in this block is shown to anyone else. There is no other
        // "else" in Bokeà - no feed, no followers, no profile page that a
        // stranger can open. It is your own record of yourself.
        public string? DisplayName { get; set; }
        public string? Pronouns { get; set; }

        // Kept as "yyyy-MM-dd" text, not a DateTime. A birthday is a date on a
        // calendar, not an instant: storing it as a timestamp makes it shift by
        // a day whenever the server and the browser disagree about the zone.
        public string? DateOfBirth { get; set; }

        // Free text, not an enum. The list of genders is not ours to close.
        public string? Gender { get; set; }

        public string? Bio { get; set; }
        public string? Country { get; set; }
        public string? City { get; set; }
        public string? TimeZoneName { get; set; }
        public string? PhoneNumber { get; set; }

        // A small square, stored as a data URL. The client resizes to 256px
        // before it ever leaves the browser, so this is tens of kilobytes and
        // there is no upload directory to secure, serve or clean up.
        public string? AvatarDataUrl { get; set; }

        // Navigation property
        public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
    }

    public class TaskItem
    {
        public int Id { get; set; }
        
        public int UserId { get; set; }
        [JsonIgnore]
        public User? User { get; set; }

        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public Sector Sector { get; set; }
        public IntervalType IntervalType { get; set; }
        public int? IntervalDays { get; set; }

        // What the database actually stores. A nullable DateTime, so a task
        // with no date at all - a parked thought - round-trips.
        //
        // The DueDateType wrapper below is the domain's view of the same
        // value. It used to be the mapped property, and because it is a
        // non-nullable reference type EF generated a reader that called
        // GetDateTime() with no IsDBNull check: every read of a row with a
        // null date threw "The data is NULL at ordinal 4". Mapping the
        // nullable value directly and keeping the wrapper unmapped fixes the
        // read without changing the column, the JSON, or any caller.
        [JsonIgnore]
        public DateTime? DueDateValue { get; set; }

        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public DueDateType DueDate
        {
            get => DueDateValue.HasValue ? new DueDateType(DueDateValue.Value) : DueDateType.Null;
            set => DueDateValue = (value != null && value.HasValue) ? value.Value : (DateTime?)null;
        }

        // ---- When in the day ----
        //
        // A due date says which day. On its own it never said when in that
        // day, which is the half that decides whether the thing happens, so
        // the API used to accept a time from the client and quietly throw it
        // away. These three keep it.
        //
        // DueTime is "HH:mm" text rather than a TimeSpan or a timestamp: it
        // is a reading on a clock face, not a duration and not an instant,
        // and storing it as either makes it slide when the zone changes.
        public string? DueTime { get; set; }

        // Which part of the day this belongs to when there is no exact time:
        // morning, afternoon, evening or anytime. Deliberately not an enum in
        // the database - the boundaries between these come from the user's own
        // wake, work and bed times, so the meaning lives with them, not here.
        public string? TimeSlot { get; set; }

        // Roughly how long it takes. Null means nobody said; the client shows
        // fifteen minutes rather than nothing, because "how long" with no
        // answer is the question that stops a task being started.
        public int? DurationMinutes { get; set; }

        // Whether missing this is allowed to turn red.
        //
        // Consistency with ADHD is spiky by nature, and a system that paints
        // every gap red within hours turns a good week into a red screen. So
        // the default is false: a soft habit ages to amber and stops there.
        // Red is reserved for the things the user has said out loud are hard
        // commitments - the bill, the appointment, the tax return.
        public bool IsCommitment { get; set; }

        public DateTime? LastCompletedAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? SnoozedUntil { get; set; }
        public TaskState State { get; set; }
        public int DisplayOrder { get; set; }

        // Navigation property for completion logs
        public ICollection<TaskCompletionLog> CompletionLogs { get; set; } = new List<TaskCompletionLog>();
    }

    public class TaskCompletionLog
    {
        public int Id { get; set; }
        public int TaskId { get; set; }
        public DateTime CompletedAt { get; set; }
        public string? Notes { get; set; }

        // Navigation property
        [JsonIgnore]
        public TaskItem? Task { get; set; }
    }

    public class PushSubscription
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        [JsonIgnore]
        public User? User { get; set; }

        public string Endpoint { get; set; } = string.Empty;
        public string P256dh { get; set; } = string.Empty;
        public string Auth { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
