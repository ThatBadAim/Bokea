using static Bokea.Desktop.Native.Win32;

namespace Bokea.Desktop;

// Shows the page's notifications through the notification area. On Windows
// 10 and 11 these appear as ordinary notifications and are kept in the
// notification centre. The icon is only added once there is something to show.
internal sealed unsafe class TrayNotifications(nint hwnd, nint smallIcon, nint largeIcon) : IDisposable
{
    public const uint CallbackMessage = WM_APP + 20;
    const uint IconId = 1;

    bool _added;

    // The notification shown most recently, which is the one a click refers to.
    public ulong CurrentId { get; private set; }

    public void Show(ulong id, string title, string body)
    {
        EnsureIcon();
        var data = NewData();
        data.uFlags = NIF_INFO;
        Copy(data.szInfoTitle, 64, title);
        Copy(data.szInfo, 256, string.IsNullOrEmpty(body) ? " " : body);
        data.dwInfoFlags = NIIF_USER | NIIF_LARGE_ICON;
        data.hBalloonIcon = largeIcon;
        if (Shell_NotifyIconW(NIM_MODIFY, &data) == 0)
            Log.Warn("A notification could not be shown.");
        CurrentId = id;
    }

    public void Hide(ulong id)
    {
        if (id == CurrentId)
            HideAll();
    }

    public void HideAll()
    {
        if (!_added)
            return;
        var data = NewData();
        data.uFlags = NIF_INFO;
        Shell_NotifyIconW(NIM_MODIFY, &data);
        CurrentId = 0;
    }

    public void Dispose()
    {
        if (!_added)
            return;
        var data = NewData();
        Shell_NotifyIconW(NIM_DELETE, &data);
        _added = false;
    }

    void EnsureIcon()
    {
        if (_added)
            return;
        var data = NewData();
        data.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP | NIF_SHOWTIP;
        data.uCallbackMessage = CallbackMessage;
        data.hIcon = smallIcon;
        Copy(data.szTip, 128, AppInfo.Name);
        _added = Shell_NotifyIconW(NIM_ADD, &data) != 0;
        if (!_added)
        {
            Log.Warn("The notification area icon could not be added.");
            return;
        }
        data.uVersion = NOTIFYICON_VERSION_4;
        Shell_NotifyIconW(NIM_SETVERSION, &data);
    }

    NOTIFYICONDATAW NewData() => new()
    {
        cbSize = (uint)sizeof(NOTIFYICONDATAW),
        hWnd = hwnd,
        uID = IconId,
    };

    static void Copy(char* destination, int capacity, string text)
    {
        var length = Math.Min(text.Length, capacity - 1);
        text.AsSpan(0, length).CopyTo(new Span<char>(destination, capacity));
        destination[length] = '\0';
    }
}
