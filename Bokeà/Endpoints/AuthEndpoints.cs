using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using Bokea.Database;

namespace Bokea.Endpoints
{
    public static class AuthEndpoints
    {
        public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/api/auth");

            // Every rule about what makes an acceptable account lives here and
            // nowhere else. The browser collects the three fields and shows
            // whatever comes back; it does not get a say in whether they pass,
            // because anything it checked could simply be skipped.
            group.MapPost("/register", async (RegisterRequest req, AppDbContext db, IConfiguration config) =>
            {
                if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password) || string.IsNullOrWhiteSpace(req.FirstName))
                {
                    return Results.BadRequest("All fields are required.");
                }

                var emailNormalized = req.Email.Trim().ToLowerInvariant();
                var firstName = req.FirstName.Trim();

                if (emailNormalized.Length > 254)
                {
                    return Results.BadRequest("That email address is too long.");
                }

                if (!System.Text.RegularExpressions.Regex.IsMatch(emailNormalized, @"^[^\s@]+@[^\s@]+\.[^\s@]+$"))
                {
                    return Results.BadRequest("Invalid email address format.");
                }

                if (firstName.Length > 100)
                {
                    return Results.BadRequest("That first name is too long.");
                }

                if (req.Password.Length < MinimumPasswordLength)
                {
                    return Results.BadRequest($"Your password must be at least {MinimumPasswordLength} characters.");
                }

                // BCrypt hashes the first 72 bytes and quietly ignores the rest,
                // which would make two different long passwords the same one.
                // Refusing is honest; silently shortening is not.
                if (Encoding.UTF8.GetByteCount(req.Password) > MaximumPasswordBytes)
                {
                    return Results.BadRequest("Your password is too long. Please use 72 characters or fewer.");
                }

                if (await db.Users.AnyAsync(u => u.Email == emailNormalized))
                {
                    return Results.BadRequest("Email is already registered.");
                }

                var user = new User
                {
                    Email = emailNormalized,
                    FirstName = firstName,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
                    IsSetupCompleted = false
                };

                db.Users.Add(user);
                await db.SaveChangesAsync();

                var jwtKey = config["Jwt:Key"] ?? "SuperSecretBokeaKeyThatNeedsToBeLongEnoughForHS256!!!123456";
                var token = GenerateJwtToken(user, jwtKey);
                return Results.Ok(new { 
                    Token = token, 
                    User = new { 
                        user.Id, 
                        user.FirstName, 
                        user.Email,
                        user.IsSetupCompleted,
                        user.WakeUpTime,
                        user.BedTime,
                        user.WorkStartTime,
                        user.WorkEndTime,
                        user.WorkDays
                    } 
                });
            });

            group.MapPost("/login", async (LoginRequest req, AppDbContext db, IConfiguration config) =>
            {
                var emailNormalized = (req.Email ?? "").Trim().ToLowerInvariant();

                if (emailNormalized.Length == 0 || string.IsNullOrEmpty(req.Password))
                {
                    return Results.Unauthorized();
                }

                var user = await db.Users.SingleOrDefaultAsync(u => u.Email == emailNormalized);

                // One answer for an address we do not hold and a password that
                // does not match it: saying which is which turns this endpoint
                // into a way of asking who has an account here.
                if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
                {
                    return Results.Unauthorized();
                }

                var jwtKey = config["Jwt:Key"] ?? "SuperSecretBokeaKeyThatNeedsToBeLongEnoughForHS256!!!123456";
                var token = GenerateJwtToken(user, jwtKey);
                return Results.Ok(new { 
                    Token = token, 
                    User = new { 
                        user.Id, 
                        user.FirstName, 
                        user.Email,
                        user.IsSetupCompleted,
                        user.WakeUpTime,
                        user.BedTime,
                        user.WorkStartTime,
                        user.WorkEndTime,
                        user.WorkDays
                    } 
                });
            });

            // POST /api/auth/setup - Save setup settings
            group.MapPost("/setup", async (SetupRequest req, AppDbContext db, ClaimsPrincipal userClaim) =>
            {
                int userId = int.Parse(userClaim.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
                var user = await db.Users.FindAsync(userId);
                if (user == null)
                {
                    return Results.NotFound("User not found.");
                }

                user.WakeUpTime = req.WakeUpTime;
                user.BedTime = req.BedTime;
                user.WorkStartTime = req.WorkStartTime;
                user.WorkEndTime = req.WorkEndTime;
                user.WorkDays = req.WorkDays != null ? string.Join(",", req.WorkDays) : null;
                user.IsSetupCompleted = true;

                await db.SaveChangesAsync();
                return Results.Ok(new { 
                    user.Id, 
                    user.FirstName, 
                    user.Email,
                    user.IsSetupCompleted,
                    user.WakeUpTime,
                    user.BedTime,
                    user.WorkStartTime,
                    user.WorkEndTime,
                    user.WorkDays
                });
            }).RequireAuthorization();

            // GET /api/auth/profile - Get current user profile & setup settings
            group.MapGet("/profile", async (AppDbContext db, ClaimsPrincipal userClaim) =>
            {
                int userId = int.Parse(userClaim.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
                var user = await db.Users.FindAsync(userId);
                if (user == null)
                {
                    return Results.NotFound("User not found.");
                }

                return Results.Ok(ProfilePayload(user));
            }).RequireAuthorization();

            // PUT /api/auth/profile - Update user profile & settings
            group.MapPut("/profile", async (SetupRequest req, AppDbContext db, ClaimsPrincipal userClaim) =>
            {
                int userId = int.Parse(userClaim.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
                var user = await db.Users.FindAsync(userId);
                if (user == null)
                {
                    return Results.NotFound("User not found.");
                }

                user.WakeUpTime = req.WakeUpTime;
                user.BedTime = req.BedTime;
                user.WorkStartTime = req.WorkStartTime;
                user.WorkEndTime = req.WorkEndTime;
                user.WorkDays = req.WorkDays != null ? string.Join(",", req.WorkDays) : null;

                await db.SaveChangesAsync();
                return Results.Ok(new { 
                    user.Id, 
                    user.FirstName, 
                    user.Email,
                    user.IsSetupCompleted,
                    user.WakeUpTime,
                    user.BedTime,
                    user.WorkStartTime,
                    user.WorkEndTime,
                    user.WorkDays
                });
            }).RequireAuthorization();

            // PUT /api/auth/profile/about - Update who the user is, as opposed
            // to when they sleep. Kept apart from PUT /profile because the two
            // are edited on different screens and a save from one must never
            // blank out the other's fields.
            //
            // Every field is optional. A null property means "leave this alone";
            // an empty string means "I have deliberately cleared this". That
            // distinction is why each assignment is guarded rather than copied.
            group.MapPut("/profile/about", async (ProfileAboutRequest req, AppDbContext db, ClaimsPrincipal userClaim) =>
            {
                int userId = int.Parse(userClaim.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
                var user = await db.Users.FindAsync(userId);
                if (user == null)
                {
                    return Results.NotFound("User not found.");
                }

                if (req.DateOfBirth != null && req.DateOfBirth.Length > 0)
                {
                    if (!DateTime.TryParseExact(req.DateOfBirth, "yyyy-MM-dd",
                            System.Globalization.CultureInfo.InvariantCulture,
                            System.Globalization.DateTimeStyles.None, out var dob))
                    {
                        return Results.BadRequest("Date of birth must be written as yyyy-MM-dd.");
                    }

                    // A birthday in the future is a typo, not a fact. Say so
                    // plainly rather than storing it and rendering a negative age.
                    if (dob.Date > DateTime.UtcNow.Date)
                    {
                        return Results.BadRequest("That date has not happened yet.");
                    }
                    if (dob.Year < 1900)
                    {
                        return Results.BadRequest("That date looks like a typo.");
                    }
                }

                if (req.Bio != null && req.Bio.Length > 400)
                {
                    return Results.BadRequest("The note about you can be up to 400 characters.");
                }

                // Roughly 1.4MB of base64, which is far more than the 256px
                // square the client sends. It is a guard against someone posting
                // a whole photo library into a text column, not a quality bar.
                if (req.AvatarDataUrl != null && req.AvatarDataUrl.Length > 0)
                {
                    if (!req.AvatarDataUrl.StartsWith("data:image/", StringComparison.Ordinal))
                    {
                        return Results.BadRequest("The picture must be an image.");
                    }
                    if (req.AvatarDataUrl.Length > 1_400_000)
                    {
                        return Results.BadRequest("That picture is too large.");
                    }
                }

                if (req.FirstName != null)
                {
                    user.FirstName = req.FirstName.Trim();
                }
                if (req.DisplayName != null) user.DisplayName = Blank(req.DisplayName);
                if (req.Pronouns != null) user.Pronouns = Blank(req.Pronouns);
                if (req.DateOfBirth != null) user.DateOfBirth = Blank(req.DateOfBirth);
                if (req.Gender != null) user.Gender = Blank(req.Gender);
                if (req.Bio != null) user.Bio = Blank(req.Bio);
                if (req.Country != null) user.Country = Blank(req.Country);
                if (req.City != null) user.City = Blank(req.City);
                if (req.TimeZoneName != null) user.TimeZoneName = Blank(req.TimeZoneName);
                if (req.PhoneNumber != null) user.PhoneNumber = Blank(req.PhoneNumber);
                if (req.AvatarDataUrl != null) user.AvatarDataUrl = Blank(req.AvatarDataUrl);

                await db.SaveChangesAsync();
                return Results.Ok(ProfilePayload(user));
            }).RequireAuthorization();
        }

        /// <summary>
        /// The account rules, stated once, on the server. They are not mirrored
        /// into the sign-up form: a rule the browser enforces is a rule anyone
        /// can decline to enforce.
        /// </summary>
        private const int MinimumPasswordLength = 8;
        private const int MaximumPasswordBytes = 72;

        /// <summary>An empty or whitespace-only value is a cleared field, not a value.</summary>
        private static string? Blank(string value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        /// <summary>
        /// Age is worked out on the way out and never written down. Storing it
        /// would mean it is wrong for one day a year, every year.
        /// </summary>
        private static int? AgeFrom(string? dateOfBirth)
        {
            if (string.IsNullOrWhiteSpace(dateOfBirth)) return null;
            if (!DateTime.TryParseExact(dateOfBirth, "yyyy-MM-dd",
                    System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.None, out var dob)) return null;

            var today = DateTime.UtcNow.Date;
            if (dob.Date > today) return null;

            var age = today.Year - dob.Year;
            if (dob.Date.AddYears(age) > today) age--;
            return age;
        }

        private static object ProfilePayload(User user) => new
        {
            user.Id,
            user.FirstName,
            user.Email,
            user.IsSetupCompleted,
            user.WakeUpTime,
            user.BedTime,
            user.WorkStartTime,
            user.WorkEndTime,
            workDays = user.WorkDays != null
                ? user.WorkDays.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList()
                : new System.Collections.Generic.List<string>(),
            user.DisplayName,
            user.Pronouns,
            user.DateOfBirth,
            age = AgeFrom(user.DateOfBirth),
            user.Gender,
            user.Bio,
            user.Country,
            user.City,
            user.TimeZoneName,
            user.PhoneNumber,
            user.AvatarDataUrl
        };

        private static string GenerateJwtToken(User user, string jwtKey)
        {
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim("FirstName", user.FirstName),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var token = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.UtcNow.AddDays(7),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }

    public class RegisterRequest
    {
        public string Email { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class LoginRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    /// <summary>
    /// Every property is nullable on purpose: null means "not sent, leave it",
    /// which lets one screen save one field without wiping the rest.
    /// </summary>
    public class ProfileAboutRequest
    {
        public string? FirstName { get; set; }
        public string? DisplayName { get; set; }
        public string? Pronouns { get; set; }
        public string? DateOfBirth { get; set; }
        public string? Gender { get; set; }
        public string? Bio { get; set; }
        public string? Country { get; set; }
        public string? City { get; set; }
        public string? TimeZoneName { get; set; }
        public string? PhoneNumber { get; set; }
        public string? AvatarDataUrl { get; set; }
    }

    public class SetupRequest
    {
        public string WakeUpTime { get; set; } = string.Empty;
        public string BedTime { get; set; } = string.Empty;
        public string WorkStartTime { get; set; } = string.Empty;
        public string WorkEndTime { get; set; } = string.Empty;
        public System.Collections.Generic.List<string> WorkDays { get; set; } = new();
    }
}
