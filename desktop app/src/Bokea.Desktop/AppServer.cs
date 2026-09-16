using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;

namespace Bokea.Desktop;

// Serves the bundled copy of the website on a fixed loopback address.
//
// The address never changes because localStorage belongs to an origin: a
// different port on the next launch would look to the page like a different
// website, with none of the user's tasks or settings.
//
// Routing copies vercel.json, so a path behaves here the way it does on the
// website: real files first, clean URLs without ".html", no trailing slash,
// and every other path answered with index.html for the app's own router.
internal sealed class AppServer : IDisposable
{
    public const int DefaultPort = 47819;
    public const string DesktopUserAgentToken = "BokeaDesktop/";

    const int MaxHeaderBytes = 32 * 1024;
    const int MaxBodyBytes = 64 * 1024;
    static readonly TimeSpan KeepAliveTimeout = TimeSpan.FromSeconds(30);

    readonly string _root;
    readonly string _handoffScript;
    readonly TcpListener _listener;
    readonly CancellationTokenSource _stop = new();

    public AppServer(string root, int port, string handoffScript)
    {
        _root = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        _handoffScript = handoffScript;
        Port = port;
        _listener = new TcpListener(IPAddress.Loopback, port) { ExclusiveAddressUse = true };
    }

    public int Port { get; }
    public string Origin => $"http://127.0.0.1:{Port}";

    // Raised on a worker thread with a same-origin URL the app window should open.
    public Action<string>? HandoffReceived { get; set; }

    public void Start()
    {
        _listener.Start(128);
        _ = AcceptLoopAsync();
        Log.Info($"App server listening on {Origin}, serving {_root}");
    }

    public void Dispose()
    {
        _stop.Cancel();
        try { _listener.Stop(); } catch { }
    }

    async Task AcceptLoopAsync()
    {
        while (!_stop.IsCancellationRequested)
        {
            Socket socket;
            try
            {
                socket = await _listener.AcceptSocketAsync(_stop.Token).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                return;
            }
            catch (Exception ex)
            {
                if (_stop.IsCancellationRequested)
                    return;
                Log.Warn($"App server accept failed: {ex.Message}");
                await Task.Delay(50).ConfigureAwait(false);
                continue;
            }
            _ = Task.Run(() => ServeConnectionAsync(socket));
        }
    }

    async Task ServeConnectionAsync(Socket socket)
    {
        using var _ = socket;
        socket.NoDelay = true;
        await using var stream = new NetworkStream(socket, ownsSocket: false);
        var buffer = new byte[MaxHeaderBytes];
        var filled = 0;

        try
        {
            while (!_stop.IsCancellationRequested)
            {
                int headerEnd;
                while ((headerEnd = buffer.AsSpan(0, filled).IndexOf("\r\n\r\n"u8)) < 0)
                {
                    if (filled == buffer.Length)
                    {
                        await WriteTextAsync(stream, 431, "Request Header Fields Too Large", keepAlive: false, head: false);
                        return;
                    }
                    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(_stop.Token);
                    timeout.CancelAfter(KeepAliveTimeout);
                    var read = await stream.ReadAsync(buffer.AsMemory(filled), timeout.Token).ConfigureAwait(false);
                    if (read == 0)
                        return;
                    filled += read;
                }

                var request = Request.Parse(Encoding.Latin1.GetString(buffer, 0, headerEnd));
                var consumed = headerEnd + 4;
                if (request is null)
                {
                    await WriteTextAsync(stream, 400, "Bad Request", keepAlive: false, head: false);
                    return;
                }

                var body = Array.Empty<byte>();
                if (request.ContentLength > 0)
                {
                    if (request.ContentLength > MaxBodyBytes)
                    {
                        await WriteTextAsync(stream, 413, "Payload Too Large", keepAlive: false, head: false);
                        return;
                    }
                    body = new byte[request.ContentLength];
                    var have = Math.Min(filled - consumed, body.Length);
                    Buffer.BlockCopy(buffer, consumed, body, 0, have);
                    consumed += have;
                    while (have < body.Length)
                    {
                        var read = await stream.ReadAsync(body.AsMemory(have), _stop.Token).ConfigureAwait(false);
                        if (read == 0)
                            return;
                        have += read;
                    }
                }

                Buffer.BlockCopy(buffer, consumed, buffer, 0, filled - consumed);
                filled -= consumed;

                if (!await RespondAsync(stream, request, body).ConfigureAwait(false))
                    return;
            }
        }
        catch (Exception ex) when (ex is IOException or SocketException or OperationCanceledException or ObjectDisposedException)
        {
            // The engine closes idle connections whenever it likes.
        }
        catch (Exception ex)
        {
            Log.Error("App server request failed", ex);
        }
    }

    async Task<bool> RespondAsync(Stream stream, Request request, byte[] body)
    {
        var keepAlive = request.KeepAlive;
        var head = request.Method == "HEAD";

        // DNS rebinding guard: only answer requests addressed to this server.
        if (!IsOwnHost(request.Header("host")))
        {
            await WriteTextAsync(stream, 421, "Misdirected Request", keepAlive: false, head);
            return false;
        }

        if (request.Path == "/__bokea/handoff")
            return await HandleHandoffAsync(stream, request, body, keepAlive);

        if (request.Method is not ("GET" or "HEAD"))
        {
            await WriteTextAsync(stream, 405, "Method Not Allowed", keepAlive, head);
            return keepAlive;
        }

        // vercel.json: "trailingSlash": false
        if (request.Path.Length > 1 && request.Path.EndsWith('/'))
            return await RedirectAsync(stream, request.Path.TrimEnd('/') + request.QueryString, keepAlive, head);

        // vercel.json: "cleanUrls": true
        if (request.Path.EndsWith(".html", StringComparison.OrdinalIgnoreCase) && ResolveFile(request.Path) is not null)
        {
            var clean = request.Path[..^".html".Length];
            if (clean.EndsWith("/index", StringComparison.OrdinalIgnoreCase))
                clean = clean[..^"index".Length];
            if (clean.Length > 1)
                clean = clean.TrimEnd('/');
            return await RedirectAsync(stream, (clean.Length == 0 ? "/" : clean) + request.QueryString, keepAlive, head);
        }

        // vercel.json routes: the filesystem first, then everything else to /index.html.
        var file = ResolveFile(request.Path) ?? ResolveFile(request.Path + ".html");
        var isAppShell = false;
        if (file is null)
        {
            file = Path.Combine(_root, "index.html");
            isAppShell = true;
        }
        else if (string.Equals(file, Path.Combine(_root, "index.html"), StringComparison.OrdinalIgnoreCase))
        {
            isAppShell = true;
        }

        if (!File.Exists(file))
        {
            await WriteTextAsync(stream, 404, "Not Found", keepAlive, head);
            return keepAlive;
        }

        // The app itself never needs this: only a normal browser does, when an
        // emailed sign-in link lands here. See Resources/handoff.js.
        if (isAppShell && !IsDesktopEngine(request))
            return await ServeShellForBrowserAsync(stream, file, keepAlive, head);

        return await ServeFileAsync(stream, request, file, keepAlive, head);
    }

    string? ResolveFile(string urlPath)
    {
        string relative;
        try
        {
            relative = Uri.UnescapeDataString(urlPath).TrimStart('/');
        }
        catch (UriFormatException)
        {
            return null;
        }
        if (relative.Contains('\0') || relative.Contains('\\') || relative.Contains(':'))
            return null;

        var full = Path.GetFullPath(Path.Combine(_root, relative.Replace('/', Path.DirectorySeparatorChar)));
        if (!full.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) && !string.Equals(full, _root, StringComparison.OrdinalIgnoreCase))
            return null;

        if (File.Exists(full))
            return full;
        if (Directory.Exists(full))
        {
            var index = Path.Combine(full, "index.html");
            if (File.Exists(index))
                return index;
        }
        return null;
    }

    async Task<bool> ServeFileAsync(Stream stream, Request request, string file, bool keepAlive, bool head)
    {
        var info = new FileInfo(file);
        var etag = $"\"{info.Length:x}-{info.LastWriteTimeUtc.Ticks:x}\"";

        if (request.Header("if-none-match") == etag)
        {
            await WriteHeadAsync(stream, 304, "Not Modified", null, 0, keepAlive, etag);
            return keepAlive;
        }

        await WriteHeadAsync(stream, 200, "OK", ContentType(file), info.Length, keepAlive, etag);
        if (!head)
        {
            await using var source = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete,
                bufferSize: 64 * 1024, FileOptions.Asynchronous | FileOptions.SequentialScan);
            await source.CopyToAsync(stream, _stop.Token).ConfigureAwait(false);
        }
        return keepAlive;
    }

    async Task<bool> ServeShellForBrowserAsync(Stream stream, string file, bool keepAlive, bool head)
    {
        var html = await File.ReadAllTextAsync(file, Encoding.UTF8, _stop.Token).ConfigureAwait(false);
        var headAt = html.IndexOf("<head>", StringComparison.OrdinalIgnoreCase);
        if (headAt >= 0)
            html = html.Insert(headAt + "<head>".Length, "\n<script>" + _handoffScript + "</script>");
        var bytes = Encoding.UTF8.GetBytes(html);

        await WriteHeadAsync(stream, 200, "OK", "text/html; charset=utf-8", bytes.Length, keepAlive, etag: null, noStore: true);
        if (!head)
            await stream.WriteAsync(bytes, _stop.Token).ConfigureAwait(false);
        return keepAlive;
    }

    async Task<bool> HandleHandoffAsync(Stream stream, Request request, byte[] body, bool keepAlive)
    {
        // Only a page this server served may hand over a link: a cross-origin
        // page cannot send this Origin, and application/json forces a CORS
        // preflight that is never answered.
        if (request.Method != "POST" || !IsOwnOrigin(request.Header("origin")))
        {
            await WriteTextAsync(stream, 403, "Forbidden", keepAlive, head: false);
            return keepAlive;
        }
        if (request.Header("content-type")?.StartsWith("application/json", StringComparison.OrdinalIgnoreCase) != true)
        {
            await WriteTextAsync(stream, 415, "Unsupported Media Type", keepAlive, head: false);
            return keepAlive;
        }

        string? target = null;
        try
        {
            using var json = JsonDocument.Parse(body);
            var path = json.RootElement.GetProperty("path").GetString() ?? "/";
            var search = json.RootElement.TryGetProperty("search", out var s) ? s.GetString() ?? "" : "";
            var hash = json.RootElement.TryGetProperty("hash", out var h) ? h.GetString() ?? "" : "";
            if (path.StartsWith('/') && !path.StartsWith("//", StringComparison.Ordinal) && !path.Contains('\\'))
                target = Origin + path + (search.Length > 0 ? "?" + search : "") + (hash.Length > 0 ? "#" + hash : "");
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException)
        {
        }

        if (target is null || HandoffReceived is null)
        {
            await WriteTextAsync(stream, 400, "Bad Request", keepAlive, head: false);
            return keepAlive;
        }

        Log.Info("A sign-in link opened in a browser was handed to the app window.");
        HandoffReceived(target);
        await WriteHeadAsync(stream, 204, "No Content", null, 0, keepAlive, etag: null, noStore: true);
        return keepAlive;
    }

    bool IsOwnHost(string? host) =>
        string.Equals(host, $"127.0.0.1:{Port}", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(host, $"localhost:{Port}", StringComparison.OrdinalIgnoreCase);

    bool IsOwnOrigin(string? origin) =>
        string.Equals(origin, Origin, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(origin, $"http://localhost:{Port}", StringComparison.OrdinalIgnoreCase);

    static bool IsDesktopEngine(Request request) =>
        request.Header("user-agent")?.Contains(DesktopUserAgentToken, StringComparison.Ordinal) == true;

    async Task<bool> RedirectAsync(Stream stream, string location, bool keepAlive, bool head)
    {
        var header = $"HTTP/1.1 308 Permanent Redirect\r\nLocation: {location}\r\nContent-Length: 0\r\nCache-Control: no-cache\r\nConnection: {(keepAlive ? "keep-alive" : "close")}\r\n\r\n";
        await stream.WriteAsync(Encoding.ASCII.GetBytes(header), _stop.Token).ConfigureAwait(false);
        return keepAlive;
    }

    async Task WriteHeadAsync(Stream stream, int status, string reason, string? contentType, long length, bool keepAlive, string? etag, bool noStore = false)
    {
        var sb = new StringBuilder(256);
        sb.Append("HTTP/1.1 ").Append(status).Append(' ').Append(reason).Append("\r\n");
        if (contentType is not null)
            sb.Append("Content-Type: ").Append(contentType).Append("\r\n");
        if (status != 304)
            sb.Append("Content-Length: ").Append(length).Append("\r\n");
        sb.Append("Cache-Control: ").Append(noStore ? "no-store" : "no-cache").Append("\r\n");
        if (etag is not null)
            sb.Append("ETag: ").Append(etag).Append("\r\n");
        sb.Append("X-Content-Type-Options: nosniff\r\n");
        sb.Append("Connection: ").Append(keepAlive ? "keep-alive" : "close").Append("\r\n\r\n");
        await stream.WriteAsync(Encoding.ASCII.GetBytes(sb.ToString()), _stop.Token).ConfigureAwait(false);
    }

    async Task WriteTextAsync(Stream stream, int status, string reason, bool keepAlive, bool head)
    {
        var bytes = Encoding.UTF8.GetBytes(reason);
        await WriteHeadAsync(stream, status, reason, "text/plain; charset=utf-8", bytes.Length, keepAlive, etag: null, noStore: true);
        if (!head)
            await stream.WriteAsync(bytes, _stop.Token).ConfigureAwait(false);
    }

    static string ContentType(string file) => Path.GetExtension(file).ToLowerInvariant() switch
    {
        ".html" or ".htm" => "text/html; charset=utf-8",
        ".js" or ".mjs" => "text/javascript; charset=utf-8",
        ".css" => "text/css; charset=utf-8",
        ".json" or ".map" => "application/json; charset=utf-8",
        ".webmanifest" => "application/manifest+json",
        ".svg" => "image/svg+xml",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".gif" => "image/gif",
        ".webp" => "image/webp",
        ".avif" => "image/avif",
        ".ico" => "image/x-icon",
        ".woff2" => "font/woff2",
        ".woff" => "font/woff",
        ".ttf" => "font/ttf",
        ".otf" => "font/otf",
        ".txt" => "text/plain; charset=utf-8",
        ".xml" => "application/xml",
        ".wasm" => "application/wasm",
        ".mp3" => "audio/mpeg",
        ".mp4" => "video/mp4",
        _ => "application/octet-stream",
    };

    sealed class Request
    {
        readonly Dictionary<string, string> _headers = new(StringComparer.OrdinalIgnoreCase);

        public string Method { get; private init; } = "";
        public string Path { get; private init; } = "/";
        public string QueryString { get; private init; } = "";
        public bool KeepAlive { get; private set; }
        public int ContentLength { get; private set; }

        public string? Header(string name) => _headers.GetValueOrDefault(name);

        public static Request? Parse(string head)
        {
            var lines = head.Split("\r\n");
            var parts = lines[0].Split(' ');
            if (parts.Length != 3 || !parts[1].StartsWith('/') || !parts[2].StartsWith("HTTP/1.", StringComparison.Ordinal))
                return null;

            var target = parts[1];
            var query = target.IndexOf('?');
            var request = new Request
            {
                Method = parts[0],
                Path = query < 0 ? target : target[..query],
                QueryString = query < 0 ? "" : target[query..],
            };

            foreach (var line in lines.AsSpan(1))
            {
                var colon = line.IndexOf(':');
                if (colon <= 0)
                    return null;
                request._headers[line[..colon].Trim()] = line[(colon + 1)..].Trim();
            }

            var connection = request.Header("connection");
            request.KeepAlive = parts[2] == "HTTP/1.1"
                ? !string.Equals(connection, "close", StringComparison.OrdinalIgnoreCase)
                : string.Equals(connection, "keep-alive", StringComparison.OrdinalIgnoreCase);

            if (request.Header("transfer-encoding") is not null)
                return null;
            if (request.Header("content-length") is { } length)
            {
                if (!int.TryParse(length, out var value) || value < 0)
                    return null;
                request.ContentLength = value;
            }
            return request;
        }
    }
}
