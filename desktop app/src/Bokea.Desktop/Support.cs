using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Bokea.Desktop;

internal static class Paths
{
    // Everything the installer lays down sits beside Bokea.exe:
    //   runtime\  the WebKit engine
    //   web\      the copy of the website
    public static string App { get; } = AppContext.BaseDirectory;
    public static string Runtime { get; } = Path.Combine(App, "runtime");
    public static string Web { get; } = Path.Combine(App, "web");

    // Everything the app writes goes to %LOCALAPPDATA%\Bokea, so an update or
    // uninstall never touches the user's tasks, history or settings.
    public static string Data { get; private set; } = "";
    public static string WebKitData => Path.Combine(Data, "WebKit");
    public static string Logs => Path.Combine(Data, "logs");
    public static string SettingsFile => Path.Combine(Data, "settings.json");

    public static void Init(string? dataDirectory)
    {
        Data = dataDirectory ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Bokea");
        Directory.CreateDirectory(Data);
    }
}

internal static class AppInfo
{
    public const string Name = "Bokeà";
    public const string AppUserModelId = "Bokea.Desktop";
    public const string WindowClass = "Bokea.Desktop.Window";

    public static string Version { get; } =
        typeof(AppInfo).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion.Split('+')[0]
        ?? "1.0.0";

    public static string ReadResource(string name)
    {
        using var stream = typeof(AppInfo).Assembly.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException($"Missing embedded resource {name}");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}

internal sealed class Options
{
    public bool DevTools { get; private set; }
    public string? DataDirectory { get; private set; }
    public int Port { get; private set; } = AppServer.DefaultPort;
    public string StartPath { get; private set; } = "/";

    public static Options Parse(string[] args)
    {
        var options = new Options();
        foreach (var arg in args)
        {
            if (arg is "--devtools")
                options.DevTools = true;
            else if (arg.StartsWith("--data-dir=", StringComparison.Ordinal))
                options.DataDirectory = arg["--data-dir=".Length..] is { Length: > 0 } folder
                    ? Path.GetFullPath(folder)
                    : throw new ArgumentException(@"--data-dir needs a folder, for example --data-dir=D:\Bokea");
            else if (arg.StartsWith("--port=", StringComparison.Ordinal) && int.TryParse(arg["--port=".Length..], out var port) && port is > 1024 and < 65536)
                options.Port = port;
            else if (arg.StartsWith("--open=", StringComparison.Ordinal) && arg["--open=".Length..].StartsWith('/'))
                options.StartPath = arg["--open=".Length..];
        }
        return options;
    }
}

internal static class Log
{
    static readonly Lock Gate = new();
    static string? s_file;

    public static void Init(string directory)
    {
        try
        {
            Directory.CreateDirectory(directory);
            s_file = Path.Combine(directory, "bokea.log");
            var info = new FileInfo(s_file);
            if (info.Exists && info.Length > 1_000_000)
                File.Move(s_file, s_file + ".old", overwrite: true);
        }
        catch
        {
            s_file = null;
        }
    }

    public static void Info(string message) => Write("INFO", message);
    public static void Warn(string message) => Write("WARN", message);
    public static void Error(string message, Exception? exception = null) =>
        Write("ERROR", exception is null ? message : $"{message}: {exception}");

    static void Write(string level, string message)
    {
        if (s_file is null)
            return;
        lock (Gate)
        {
            try
            {
                File.AppendAllText(s_file, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} [{level}] {message}{Environment.NewLine}");
            }
            catch
            {
                // A log that cannot be written is not worth stopping the app for.
            }
        }
    }
}

internal sealed class WindowBounds
{
    public int Left { get; set; }
    public int Top { get; set; }
    public int Right { get; set; }
    public int Bottom { get; set; }
    public bool Maximized { get; set; }
}

internal sealed class Settings
{
    public WindowBounds? Window { get; set; }
    public double Zoom { get; set; } = 1.0;

    // Last colour the page painted, so the window opens in it instead of
    // flashing white before the page has loaded.
    public string Background { get; set; } = "#F8F7F5";
    public bool Dark { get; set; }

    // Whether the page has been granted the Notification permission.
    public bool NotificationsAllowed { get; set; }

    public static Settings Load()
    {
        try
        {
            if (File.Exists(Paths.SettingsFile))
                return JsonSerializer.Deserialize(File.ReadAllText(Paths.SettingsFile), SettingsJsonContext.Default.Settings) ?? new Settings();
        }
        catch (Exception ex)
        {
            Log.Warn($"Settings could not be read and were reset: {ex.Message}");
        }
        return new Settings();
    }

    public void Save()
    {
        try
        {
            var temp = Paths.SettingsFile + ".tmp";
            File.WriteAllText(temp, JsonSerializer.Serialize(this, SettingsJsonContext.Default.Settings));
            File.Move(temp, Paths.SettingsFile, overwrite: true);
        }
        catch (Exception ex)
        {
            Log.Warn($"Settings could not be saved: {ex.Message}");
        }
    }
}

[JsonSourceGenerationOptions(WriteIndented = true)]
[JsonSerializable(typeof(Settings))]
internal sealed partial class SettingsJsonContext : JsonSerializerContext;
