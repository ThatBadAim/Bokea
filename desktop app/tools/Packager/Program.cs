using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

// Build steps for the Bokeà desktop app:
//
//   web     copy Bokeà/wwwroot and bundle the fonts and scripts it loads from CDNs
//   webkit  download the pinned WebKit engine, check it, and drop what is never loaded
//   stage   put Bokea.exe, the engine and the web files together in one folder
//   zip     zip a staged folder
//
// The website itself is only ever read. Every change is made to the copy.

if (args.Length == 0)
    return Usage();

var options = new Dictionary<string, string>(StringComparer.Ordinal);
for (var i = 1; i + 1 < args.Length; i += 2)
    options[args[i].TrimStart('-')] = args[i + 1];

string Option(string name) => options.TryGetValue(name, out var value)
    ? value
    : throw new ArgumentException($"--{name} is required for '{args[0]}'");

try
{
    switch (args[0])
    {
        case "web":
            await WebAssets.SyncAsync(Option("source"), Option("out"), Option("cache"));
            break;
        case "webkit":
            await Engine.FetchAsync(Option("out"), Option("cache"), options.GetValueOrDefault("zip"));
            break;
        case "stage":
            Stage.Run(Option("app"), Option("web"), Option("runtime"), Option("notices"), Option("out"));
            break;
        case "zip":
            Stage.Zip(Option("dir"), Option("out"));
            break;
        default:
            return Usage();
    }
    return 0;
}
catch (Exception ex)
{
    Console.Error.WriteLine($"error: {ex.Message}");
    return 1;
}

static int Usage()
{
    Console.Error.WriteLine("""
        usage:
          Packager web    --source <wwwroot> --out <dir> --cache <dir>
          Packager webkit --out <dir> --cache <dir> [--zip <webkit-win64.zip>]
          Packager stage  --app <publish dir> --web <dir> --runtime <dir> --notices <file> --out <dir>
          Packager zip    --dir <dir> --out <file.zip>
        """);
    return 2;
}

static class Http
{
    public const string BrowserUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

    // Google Fonts sends one variable font per family to browsers it knows
    // can draw them, and a separate static file per weight to older ones.
    // The desktop engine draws web fonts through DirectWrite, and where that
    // cannot apply a variable font's weight every weight comes out the same
    // (seen under Wine). Static files look identical at each weight and leave
    // nothing to the platform, so the build asks for those.
    public const string StaticFontsUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36";

    static readonly HttpClient Client = new(new HttpClientHandler { AutomaticDecompression = DecompressionMethods.All })
    {
        Timeout = TimeSpan.FromMinutes(15),
    };

    // Downloads are cached by URL, so rebuilding does not fetch the same files
    // again and a build works offline once the cache is warm.
    public static async Task<(byte[] Body, Uri Final)> GetAsync(string url, string cache, string userAgent = BrowserUserAgent)
    {
        var key = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(userAgent + "\n" + url)));
        var bodyFile = Path.Combine(cache, "http", key);
        var finalFile = bodyFile + ".url";
        if (File.Exists(bodyFile) && File.Exists(finalFile))
            return (await File.ReadAllBytesAsync(bodyFile), new Uri(await File.ReadAllTextAsync(finalFile)));

        Console.WriteLine($"  fetch {url}");
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.UserAgent.ParseAdd(userAgent);
        using var response = await Client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsByteArrayAsync();
        var final = response.RequestMessage?.RequestUri ?? new Uri(url);

        Directory.CreateDirectory(Path.GetDirectoryName(bodyFile)!);
        await File.WriteAllBytesAsync(bodyFile, body);
        await File.WriteAllTextAsync(finalFile, final.ToString());
        return (body, final);
    }

    public static async Task DownloadFileAsync(string url, string destination)
    {
        Console.WriteLine($"  fetch {url}");
        using var response = await Client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();
        Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
        await using var file = File.Create(destination);
        await response.Content.CopyToAsync(file);
    }
}

static partial class WebAssets
{
    [GeneratedRegex("""^[ \t]*<link\b[^>]*\brel="preconnect"[^>]*>[ \t]*\r?\n?""", RegexOptions.IgnoreCase | RegexOptions.Multiline)]
    private static partial Regex PreconnectLink();

    [GeneratedRegex("""<link\b[^>]*\bhref="(https://fonts\.googleapis\.com/[^"]+)"[^>]*>""", RegexOptions.IgnoreCase)]
    private static partial Regex FontStylesheet();

    [GeneratedRegex("""<script\b[^>]*\bsrc="(https://(?:unpkg\.com|cdn\.jsdelivr\.net)/[^"]+)"[^>]*>""", RegexOptions.IgnoreCase)]
    private static partial Regex CdnScript();

    [GeneratedRegex("""url\((https://fonts\.gstatic\.com/[^)]+)\)""")]
    private static partial Regex FontFileUrl();

    [GeneratedRegex("""^//[#@] sourceMappingURL=.*$""", RegexOptions.Multiline)]
    private static partial Regex SourceMapComment();

    [GeneratedRegex("""(?:src|href)="https?://[^"]+""", RegexOptions.IgnoreCase)]
    private static partial Regex AnyRemoteReference();

    [GeneratedRegex("""['"](https://[^'"\s]+)['"]""")]
    private static partial Regex QuotedUrl();

    // The hosts the build takes a copy from. A reference to one of these left
    // in the copy would be fetched over the network at run time, which the
    // desktop app must never need.
    static readonly string[] VendoredHosts = ["fonts.googleapis.com", "fonts.gstatic.com", "unpkg.com", "cdn.jsdelivr.net"];

    public static async Task SyncAsync(string source, string output, string cache)
    {
        source = Path.GetFullPath(source);
        output = Path.GetFullPath(output);
        if (!File.Exists(Path.Combine(source, "index.html")))
            throw new FileNotFoundException($"No index.html in {source}");

        Console.WriteLine($"web: copying {source}");
        if (Directory.Exists(output))
            Directory.Delete(output, recursive: true);
        Stage.CopyDirectory(source, output);

        var vendor = Path.Combine(output, "vendor");
        Directory.CreateDirectory(Path.Combine(vendor, "fonts"));
        var sources = new SortedDictionary<string, string>(StringComparer.Ordinal);
        var bundled = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var htmlFile in Directory.GetFiles(output, "*.html", SearchOption.TopDirectoryOnly))
        {
            var html = await File.ReadAllTextAsync(htmlFile, Encoding.UTF8);

            // The bundled copies are served locally, so there is nothing to preconnect to.
            html = PreconnectLink().Replace(html, "");

            foreach (Match match in FontStylesheet().Matches(html))
            {
                var url = WebUtility.HtmlDecode(match.Groups[1].Value);
                var local = await VendorFontsAsync(url, vendor, cache, sources);
                if (VendorKey(url) is { } key)
                    bundled[key] = local;
                html = html.Replace(match.Value, match.Value.Replace(match.Groups[1].Value, local));
            }

            foreach (Match match in CdnScript().Matches(html))
            {
                var url = WebUtility.HtmlDecode(match.Groups[1].Value);
                var local = await VendorScriptAsync(url, vendor, cache, sources);
                if (VendorKey(url) is { } key)
                    bundled[key] = local;
                html = html.Replace(match.Value, match.Value.Replace(match.Groups[1].Value, local));
            }

            await File.WriteAllTextAsync(htmlFile, html, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));

            foreach (Match leftover in AnyRemoteReference().Matches(html))
                Console.WriteLine($"  note: {Path.GetFileName(htmlFile)} still loads {leftover.Value}");
        }

        await RewriteScriptsAsync(output, vendor, bundled);

        await File.WriteAllLinesAsync(Path.Combine(vendor, "SOURCES.txt"),
            sources.Select(pair => $"{pair.Key}  <=  {pair.Value}"));
        Console.WriteLine($"web: bundled {sources.Count} remote files into {vendor}");
    }

    // The page's own scripts name the same CDN files the HTML does. The
    // service worker is the one that matters: it pre-caches a fixed list with
    // cache.addAll, which fails as a whole if any entry cannot be fetched, so
    // leaving a CDN address in it would stop the worker installing on a
    // machine with no network - the state this app is built to work in.
    static async Task RewriteScriptsAsync(string output, string vendor, IReadOnlyDictionary<string, string> bundled)
    {
        foreach (var scriptFile in Directory.EnumerateFiles(output, "*.js", SearchOption.AllDirectories))
        {
            if (scriptFile.StartsWith(vendor + Path.DirectorySeparatorChar, StringComparison.Ordinal))
                continue;

            var script = await File.ReadAllTextAsync(scriptFile, Encoding.UTF8);
            var rewritten = script;
            foreach (Match match in QuotedUrl().Matches(script).DistinctBy(m => m.Groups[1].Value))
            {
                var url = match.Groups[1].Value;
                if (VendorKey(url) is { } key && bundled.TryGetValue(key, out var local))
                    rewritten = rewritten.Replace(url, local);
            }
            if (rewritten != script)
                await File.WriteAllTextAsync(scriptFile, rewritten, new UTF8Encoding(false));

            foreach (Match leftover in QuotedUrl().Matches(rewritten).DistinctBy(m => m.Groups[1].Value))
                if (Uri.TryCreate(leftover.Groups[1].Value, UriKind.Absolute, out var uri) &&
                    VendoredHosts.Contains(uri.Host, StringComparer.OrdinalIgnoreCase))
                    Console.WriteLine($"  note: {Path.GetRelativePath(output, scriptFile)} still loads {leftover.Groups[1].Value}");
        }
    }

    // Two addresses name the same bundled file when they differ only in the
    // version pinned on the last path segment: the service worker asks for
    // "lucide@latest" and "supabase-js@2" where index.html pins exact
    // versions, and the build has taken one copy for both.
    static string? VendorKey(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            return null;
        var segments = uri.AbsolutePath.Split('/');
        // An "@" at the start of a segment is an npm scope, not a version.
        var at = segments[^1].IndexOf('@', Math.Min(1, segments[^1].Length));
        if (at > 0)
            segments[^1] = segments[^1][..at];
        return uri.Host + string.Join('/', segments) + uri.Query;
    }

    static async Task<string> VendorFontsAsync(string url, string vendor, string cache, IDictionary<string, string> sources)
    {
        var (body, _) = await Http.GetAsync(url, cache, Http.StaticFontsUserAgent);
        var css = Encoding.UTF8.GetString(body);

        foreach (Match match in FontFileUrl().Matches(css).DistinctBy(m => m.Groups[1].Value))
        {
            var fontUrl = match.Groups[1].Value;
            var path = new Uri(fontUrl).AbsolutePath;
            var name = (path.StartsWith("/s/", StringComparison.Ordinal) ? path[3..] : path.TrimStart('/')).Replace('/', '-');
            var (font, _) = await Http.GetAsync(fontUrl, cache);
            await File.WriteAllBytesAsync(Path.Combine(vendor, "fonts", name), font);
            sources[$"/vendor/fonts/{name}"] = fontUrl;
            css = css.Replace($"url({fontUrl})", $"url(/vendor/fonts/{name})");
        }

        var cssName = $"fonts-{Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(url)))[..10]}.css";
        await File.WriteAllTextAsync(Path.Combine(vendor, cssName), css, new UTF8Encoding(false));
        sources[$"/vendor/{cssName}"] = url;
        return $"/vendor/{cssName}";
    }

    static async Task<string> VendorScriptAsync(string url, string vendor, string cache, IDictionary<string, string> sources)
    {
        var (body, final) = await Http.GetAsync(url, cache);
        var script = SourceMapComment().Replace(Encoding.UTF8.GetString(body), "");

        var name = new Uri(url).Segments[^1].Trim('/');
        if (!name.EndsWith(".js", StringComparison.OrdinalIgnoreCase))
            name += ".js";

        await File.WriteAllTextAsync(Path.Combine(vendor, name), script, new UTF8Encoding(false));
        sources[$"/vendor/{name}"] = final.ToString();
        return $"/vendor/{name}";
    }
}

static class Engine
{
    // The WebKit Windows port, as built by the Playwright project from upstream
    // WebKit. To move to a newer engine, change these three values, run the
    // build, and regenerate the client slot numbers in Native/WebKit.cs.
    public const string Revision = "2359";
    const string ZipUrl = $"https://playwright.download.prss.microsoft.com/dbazure/download/playwright/builds/webkit/{Revision}/webkit-win64.zip";
    const string ZipSha256 = "b9a4d90a004b0119ff590e26fddc84e2df0bb512304823974003a79b7d0bd2db";

    // Present in the archive but never loaded: nothing imports them, and the
    // test browser is not needed. Found by walking every binary's import table.
    static readonly string[] NotNeeded =
    [
        "Playwright.exe", "protocol.json", "harfbuzz-subset.dll", "icuio77.dll", "icutest77.dll", "icutu77.dll",
        "jxl_threads.dll", "libexslt.dll", "libwebpdecoder.dll", "tls-33.dll", "turbojpeg.dll",
    ];

    public static async Task FetchAsync(string output, string cache, string? localZip)
    {
        output = Path.GetFullPath(output);
        var zip = localZip ?? Path.Combine(cache, $"webkit-win64-r{Revision}.zip");

        if (!File.Exists(zip) || !await HashMatchesAsync(zip))
        {
            if (localZip is not null)
                throw new InvalidDataException($"{localZip} is not WebKit r{Revision} (sha256 mismatch)");
            var partial = zip + ".part";
            await Http.DownloadFileAsync(ZipUrl, partial);
            if (!await HashMatchesAsync(partial))
                throw new InvalidDataException("The downloaded WebKit archive failed its sha256 check");
            File.Move(partial, zip, overwrite: true);
        }

        Console.WriteLine($"webkit: extracting r{Revision}");
        if (Directory.Exists(output))
            Directory.Delete(output, recursive: true);
        ZipFile.ExtractToDirectory(zip, output);

        foreach (var name in NotNeeded)
        {
            var path = Path.Combine(output, name);
            if (File.Exists(path))
                File.Delete(path);
        }

        var bytes = Directory.EnumerateFiles(output, "*", SearchOption.AllDirectories).Sum(f => new FileInfo(f).Length);
        Console.WriteLine($"webkit: {bytes / 1_000_000.0:F1} MB in {output}");
    }

    static async Task<bool> HashMatchesAsync(string file)
    {
        await using var stream = File.OpenRead(file);
        var hash = Convert.ToHexStringLower(await SHA256.HashDataAsync(stream));
        return hash == ZipSha256;
    }
}

static class Stage
{
    public static void Run(string app, string web, string runtime, string notices, string output)
    {
        output = Path.GetFullPath(output);
        var exe = Path.Combine(app, "Bokea.exe");
        if (!File.Exists(exe))
            throw new FileNotFoundException($"No Bokea.exe in {app}");

        if (Directory.Exists(output))
            Directory.Delete(output, recursive: true);
        Directory.CreateDirectory(output);

        File.Copy(exe, Path.Combine(output, "Bokea.exe"));
        CopyDirectory(runtime, Path.Combine(output, "runtime"));
        CopyDirectory(web, Path.Combine(output, "web"));
        File.Copy(notices, Path.Combine(output, "THIRD-PARTY-NOTICES.txt"));

        var bytes = Directory.EnumerateFiles(output, "*", SearchOption.AllDirectories).Sum(f => new FileInfo(f).Length);
        Console.WriteLine($"stage: {bytes / 1_000_000.0:F1} MB in {output}");
    }

    public static void Zip(string directory, string zipFile)
    {
        zipFile = Path.GetFullPath(zipFile);
        if (File.Exists(zipFile))
            File.Delete(zipFile);
        ZipFile.CreateFromDirectory(directory, zipFile, CompressionLevel.SmallestSize, includeBaseDirectory: true);
        Console.WriteLine($"zip: {new FileInfo(zipFile).Length / 1_000_000.0:F1} MB {zipFile}");
    }

    public static void CopyDirectory(string source, string destination)
    {
        foreach (var directory in Directory.EnumerateDirectories(source, "*", SearchOption.AllDirectories))
            Directory.CreateDirectory(Path.Combine(destination, Path.GetRelativePath(source, directory)));
        Directory.CreateDirectory(destination);
        foreach (var file in Directory.EnumerateFiles(source, "*", SearchOption.AllDirectories))
            File.Copy(file, Path.Combine(destination, Path.GetRelativePath(source, file)), overwrite: true);
    }
}
