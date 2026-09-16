using System.Runtime.InteropServices;
using System.Text;
using static Bokea.Desktop.Native.Win32;

namespace Bokea.Desktop;

internal static unsafe class Dialogs
{
    // The Windows open-file dialog, filtered by the <input accept="..."> list.
    public static List<string> OpenFiles(nint owner, bool multiple, IReadOnlyList<string> mimeTypes, IReadOnlyList<string> extensions)
    {
        var patterns = Patterns(mimeTypes, extensions);
        var filter = new StringBuilder();
        if (patterns.Count > 0)
        {
            var joined = string.Join(";", patterns);
            filter.Append(Describe(mimeTypes)).Append(" (").Append(string.Join(", ", patterns)).Append(")\0").Append(joined).Append('\0');
        }
        filter.Append("All files (*.*)\0*.*\0\0");

        var buffer = new char[multiple ? 65536 : 4096];
        var title = multiple ? "Choose files" : "Choose a file";
        fixed (char* filterText = filter.ToString())
        fixed (char* fileBuffer = buffer)
        fixed (char* titleText = title)
        {
            var dialog = new OPENFILENAMEW
            {
                lStructSize = (uint)sizeof(OPENFILENAMEW),
                hwndOwner = owner,
                lpstrFilter = filterText,
                nFilterIndex = 1,
                lpstrFile = fileBuffer,
                nMaxFile = (uint)buffer.Length,
                lpstrTitle = titleText,
                Flags = OFN_EXPLORER | OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST | OFN_HIDEREADONLY | OFN_NOCHANGEDIR |
                        (multiple ? OFN_ALLOWMULTISELECT : 0),
            };
            if (GetOpenFileNameW(&dialog) == 0)
            {
                var error = CommDlgExtendedError();
                if (error != 0)
                    Log.Warn($"The file dialog failed ({error:x}).");
                return [];
            }
        }

        // One file: a full path. Several: the folder, then each name, then an empty string.
        var parts = new List<string>();
        var start = 0;
        for (var i = 0; i < buffer.Length; i++)
        {
            if (buffer[i] != '\0')
                continue;
            if (i == start)
                break;
            parts.Add(new string(buffer, start, i - start));
            start = i + 1;
        }
        return parts.Count <= 1 ? parts : parts.Skip(1).Select(name => Path.Combine(parts[0], name)).ToList();
    }

    static List<string> Patterns(IReadOnlyList<string> mimeTypes, IReadOnlyList<string> extensions)
    {
        var patterns = new List<string>();
        void Add(params string[] names)
        {
            foreach (var name in names)
                if (!patterns.Contains("*." + name))
                    patterns.Add("*." + name);
        }

        foreach (var type in mimeTypes)
        {
            switch (type.Trim().ToLowerInvariant())
            {
                case "image/png": Add("png"); break;
                case "image/jpeg": Add("jpg", "jpeg", "jfif"); break;
                case "image/webp": Add("webp"); break;
                case "image/gif": Add("gif"); break;
                case "image/avif": Add("avif"); break;
                case "image/bmp": Add("bmp"); break;
                case "image/svg+xml": Add("svg"); break;
                case "image/*": Add("png", "jpg", "jpeg", "gif", "webp", "avif", "bmp"); break;
                case "application/json": Add("json"); break;
                case "text/plain": Add("txt"); break;
                case "text/csv": Add("csv"); break;
            }
        }
        foreach (var extension in extensions)
            Add(extension.Trim().TrimStart('*').TrimStart('.').ToLowerInvariant());
        return patterns;
    }

    static string Describe(IReadOnlyList<string> mimeTypes) =>
        mimeTypes.Count > 0 && mimeTypes.All(t => t.StartsWith("image/", StringComparison.OrdinalIgnoreCase)) ? "Images"
        : mimeTypes.Count > 0 && mimeTypes.All(t => t.Contains("json", StringComparison.OrdinalIgnoreCase)) ? "JSON files"
        : "Supported files";
}

internal static unsafe class Downloads
{
    static readonly HashSet<string> ReservedNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    };

    public static string Folder()
    {
        var id = FOLDERID_Downloads;
        char* path;
        if (SHGetKnownFolderPath(&id, 0, 0, &path) == 0 && path is not null)
        {
            try { return new string(path); }
            finally { Marshal.FreeCoTaskMem((nint)path); }
        }
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
    }

    // "name.json", then "name (1).json", "name (2).json"... as browsers do.
    public static string UniquePath(string folder, string? suggestedName)
    {
        Directory.CreateDirectory(folder);
        var name = Path.GetFileName(suggestedName ?? "");
        foreach (var invalid in Path.GetInvalidFileNameChars())
            name = name.Replace(invalid, '_');
        name = name.Trim().Trim('.');
        if (name.Length == 0)
            name = "download";
        if (name.Length > 150)
            name = name[..150];
        if (ReservedNames.Contains(Path.GetFileNameWithoutExtension(name)))
            name = "_" + name;

        var stem = Path.GetFileNameWithoutExtension(name);
        var extension = Path.GetExtension(name);
        var candidate = Path.Combine(folder, name);
        for (var n = 1; File.Exists(candidate); n++)
            candidate = Path.Combine(folder, $"{stem} ({n}){extension}");
        return candidate;
    }
}
