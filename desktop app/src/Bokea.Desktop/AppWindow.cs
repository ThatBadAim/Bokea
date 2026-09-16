using System.Globalization;
using System.Runtime.InteropServices;
using System.Text.Json;
using Bokea.Desktop.Native;
using static Bokea.Desktop.Native.Win32;

namespace Bokea.Desktop;

// The Bokeà window: a plain Win32 window with the WebKit view filling it.
//
// WebKit calls back into static [UnmanagedCallersOnly] methods, which find
// the window through s_current. There is only ever one window.
internal sealed unsafe class AppWindow
{
    const uint WM_APP_RUN_QUEUED = WM_APP + 1;
    const uint WM_APP_FINISH_CLOSE = WM_APP + 2;
    const nuint CloseTimerId = 1;
    static readonly double[] ZoomSteps = [0.5, 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

    static AppWindow? s_current;

    readonly Settings _settings;
    readonly Options _options;
    readonly AppServer _server;
    readonly Queue<Action> _queue = new();
    readonly Lock _queueGate = new();

    nint _hwnd;
    nint _view;
    nint _viewHwnd;
    nint _viewProc;
    nint _page;
    nint _context;
    nint _notificationManager;
    nint _downloadClient;
    nint _backgroundBrush;
    nint _smallIcon;
    nint _largeIcon;
    TrayNotifications? _tray;

    bool _closing;
    bool _fullscreen;
    WINDOWPLACEMENT _placementBeforeFullscreen;
    int _wheelZoomDelta;
    int _recentCrashes;
    DateTime _firstCrashAt;

    public AppWindow(Settings settings, Options options, AppServer server)
    {
        _settings = settings;
        _options = options;
        _server = server;
        s_current = this;
    }

    // ---- Creation ------------------------------------------------------------

    public void Create()
    {
        var instance = GetModuleHandleW(null);
        _largeIcon = LoadImageW(instance, APP_ICON_RESOURCE, IMAGE_ICON, 256, 256, LR_DEFAULTCOLOR);
        _smallIcon = LoadImageW(instance, APP_ICON_RESOURCE, IMAGE_ICON, 32, 32, LR_DEFAULTCOLOR);

        fixed (char* className = AppInfo.WindowClass)
        {
            var windowClass = new WNDCLASSEXW
            {
                cbSize = (uint)sizeof(WNDCLASSEXW),
                style = CS_HREDRAW | CS_VREDRAW,
                lpfnWndProc = &WindowProc,
                hInstance = instance,
                hIcon = _largeIcon,
                hIconSm = _smallIcon,
                hCursor = LoadCursorW(0, IDC_ARROW),
                lpszClassName = className,
            };
            if (RegisterClassExW(&windowClass) == 0)
                throw new InvalidOperationException($"RegisterClassEx failed ({Marshal.GetLastPInvokeError()})");
        }

        _hwnd = CreateWindowExW(0, AppInfo.WindowClass, AppInfo.Name, WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN,
            CW_USEDEFAULT, CW_USEDEFAULT, 1280, 860, 0, 0, instance, 0);
        if (_hwnd == 0)
            throw new InvalidOperationException($"CreateWindowEx failed ({Marshal.GetLastPInvokeError()})");

        ApplyTheme(_settings.Dark, ParseHexColor(_settings.Background));
        RestorePlacement();
        CreateWebView();

        ShowWindow(_hwnd, _settings.Window?.Maximized == true ? SW_SHOWMAXIMIZED : SW_SHOWNORMAL);
        UpdateWindow(_hwnd);
        SetFocus(_viewHwnd);
    }

    void CreateWebView()
    {
        var contextConfiguration = WK.WKContextConfigurationCreate();
        _context = WK.WKContextCreateWithConfiguration(contextConfiguration);
        WK.WKRelease(contextConfiguration);

        _notificationManager = WK.WKContextGetNotificationManager(_context);
        var provider = WK.CreateClient(WK.NotificationProvider.Version, WK.NotificationProvider.SlotCount, 0);
        WK.SetSlot(provider, WK.NotificationProvider.Show, (nint)(delegate* unmanaged<nint, nint, nint, void>)&OnShowNotification);
        WK.SetSlot(provider, WK.NotificationProvider.Cancel, (nint)(delegate* unmanaged<nint, nint, void>)&OnCancelNotification);
        WK.SetSlot(provider, WK.NotificationProvider.NotificationPermissions, (nint)(delegate* unmanaged<nint, nint>)&OnNotificationPermissions);
        WK.SetSlot(provider, WK.NotificationProvider.ClearNotifications, (nint)(delegate* unmanaged<nint, nint, void>)&OnClearNotifications);
        WK.WKNotificationManagerSetProvider(_notificationManager, provider);

        // Everything the engine stores lives under %LOCALAPPDATA%\Bokea\WebKit.
        var storeConfiguration = WK.WKWebsiteDataStoreConfigurationCreate();
        var root = Paths.WebKitData;
        Directory.CreateDirectory(root);
        using (var dir = new WK.Owned(WK.String(Path.Combine(root, "Storage"))))
            WK.WKWebsiteDataStoreConfigurationSetGeneralStorageDirectory(storeConfiguration, dir.Handle);
        using (var dir = new WK.Owned(WK.String(Path.Combine(root, "LocalStorage"))))
            WK.WKWebsiteDataStoreConfigurationSetLocalStorageDirectory(storeConfiguration, dir.Handle);
        using (var dir = new WK.Owned(WK.String(Path.Combine(root, "IndexedDB"))))
            WK.WKWebsiteDataStoreConfigurationSetIndexedDBDatabaseDirectory(storeConfiguration, dir.Handle);
        using (var dir = new WK.Owned(WK.String(Path.Combine(root, "CacheStorage"))))
            WK.WKWebsiteDataStoreConfigurationSetCacheStorageDirectory(storeConfiguration, dir.Handle);
        using (var dir = new WK.Owned(WK.String(Path.Combine(root, "NetworkCache"))))
            WK.WKWebsiteDataStoreConfigurationSetNetworkCacheDirectory(storeConfiguration, dir.Handle);
        using (var dir = new WK.Owned(WK.String(Path.Combine(root, "ServiceWorkers"))))
            WK.WKWebsiteDataStoreConfigurationSetServiceWorkerRegistrationDirectory(storeConfiguration, dir.Handle);
        using (var dir = new WK.Owned(WK.String(Path.Combine(root, "MediaKeys"))))
            WK.WKWebsiteDataStoreConfigurationSetMediaKeysStorageDirectory(storeConfiguration, dir.Handle);
        using (var dir = new WK.Owned(WK.String(Path.Combine(root, "ResourceLoadStatistics"))))
            WK.WKWebsiteDataStoreConfigurationSetResourceLoadStatisticsDirectory(storeConfiguration, dir.Handle);
        using (var dir = new WK.Owned(WK.String(Path.Combine(root, "WebSQL"))))
            WK.WKWebsiteDataStoreConfigurationSetWebSQLDatabaseDirectory(storeConfiguration, dir.Handle);
        using (var file = new WK.Owned(WK.String(Path.Combine(root, "cookies.db"))))
            WK.WKWebsiteDataStoreConfigurationSetCookieStorageFile(storeConfiguration, file.Handle);
        var dataStore = WK.WKWebsiteDataStoreCreateWithConfiguration(storeConfiguration);
        WK.WKRelease(storeConfiguration);

        var preferences = WK.WKPreferencesCreate();
        WK.WKPreferencesSetNotificationsEnabled(preferences, 1);
        WK.WKPreferencesSetDownloadAttributeEnabled(preferences, 1);
        WK.WKPreferencesSetDeveloperExtrasEnabled(preferences, _options.DevTools ? (byte)1 : (byte)0);

        var userContent = WK.WKUserContentControllerCreate();
        using (var source = new WK.Owned(WK.String(AppInfo.ReadResource("bridge.js"))))
        {
            var script = WK.WKUserScriptCreateWithSource(source.Handle, WK.kWKInjectAtDocumentStart, 1);
            WK.WKUserContentControllerAddUserScript(userContent, script);
            WK.WKRelease(script);
        }
        using (var name = new WK.Owned(WK.String("bokea")))
            WK.WKUserContentControllerAddScriptMessageHandler(userContent, name.Handle,
                (nint)(delegate* unmanaged<nint, nint, nint, void>)&OnScriptMessage, 0);
#if BOKEA_TEST_HOOKS
        // Test builds only (-p:BokeaTestHooks=true): drive the page from a script
        // so the app can be exercised end to end without a person at the keyboard.
        if (Environment.GetEnvironmentVariable("BOKEA_TEST_SCRIPT") is { Length: > 0 } testScript && File.Exists(testScript))
        {
            Log.Warn($"Test build: injecting {testScript}");
            using var testSource = new WK.Owned(WK.String(File.ReadAllText(testScript)));
            var script = WK.WKUserScriptCreateWithSource(testSource.Handle, 1, 1);
            WK.WKUserContentControllerAddUserScript(userContent, script);
            WK.WKRelease(script);
        }
#endif

        var pageConfiguration = WK.WKPageConfigurationCreate();
        WK.WKPageConfigurationSetContext(pageConfiguration, _context);
        WK.WKPageConfigurationSetWebsiteDataStore(pageConfiguration, dataStore);
        WK.WKPageConfigurationSetPreferences(pageConfiguration, preferences);
        WK.WKPageConfigurationSetUserContentController(pageConfiguration, userContent);

        RECT client;
        GetClientRect(_hwnd, &client);
        _view = WK.WKViewCreate(client, pageConfiguration, _hwnd);
        WK.WKRelease(pageConfiguration);
        WK.WKRelease(userContent);
        WK.WKRelease(preferences);
        WK.WKRelease(dataStore);
        if (_view == 0)
            throw new InvalidOperationException("WKViewCreate returned no view");

        WK.WKViewSetIsInWindow(_view, 1);
        _viewHwnd = WK.WKViewGetWindow(_view);
        _page = WK.WKViewGetPage(_view);
        _viewProc = SetWindowLongPtrW(_viewHwnd, GWLP_WNDPROC, (nint)(delegate* unmanaged<nint, uint, nint, nint, nint>)&ViewProc);

        InstallPageClients();

        using (var appName = new WK.Owned(WK.String(AppServer.DesktopUserAgentToken + AppInfo.Version)))
            WK.WKPageSetApplicationNameForUserAgent(_page, appName.Handle);
        WK.WKPageSetPageZoomFactor(_page, _settings.Zoom);

        LayoutView();
    }

    void InstallPageClients()
    {
        var ui = WK.CreateClient(WK.UIClient.Version, WK.UIClient.SlotCount, 0);
        WK.SetSlot(ui, WK.UIClient.Close, (nint)(delegate* unmanaged<nint, nint, void>)&OnPageClose);
        WK.SetSlot(ui, WK.UIClient.Focus, (nint)(delegate* unmanaged<nint, nint, void>)&OnPageFocus);
        WK.SetSlot(ui, WK.UIClient.DidNotHandleKeyEvent, (nint)(delegate* unmanaged<nint, MSG*, nint, void>)&OnDidNotHandleKeyEvent);
        WK.SetSlot(ui, WK.UIClient.RunOpenPanel, (nint)(delegate* unmanaged<nint, nint, nint, nint, nint, void>)&OnRunOpenPanel);
        WK.SetSlot(ui, WK.UIClient.DecidePolicyForNotificationPermissionRequest, (nint)(delegate* unmanaged<nint, nint, nint, nint, void>)&OnNotificationPermissionRequest);
        WK.SetSlot(ui, WK.UIClient.CreateNewPage, (nint)(delegate* unmanaged<nint, nint, nint, nint, nint, nint>)&OnCreateNewPage);
        WK.SetSlot(ui, WK.UIClient.RunJavaScriptAlert, (nint)(delegate* unmanaged<nint, nint, nint, nint, nint, nint, void>)&OnRunJavaScriptAlert);
        WK.SetSlot(ui, WK.UIClient.RunJavaScriptConfirm, (nint)(delegate* unmanaged<nint, nint, nint, nint, nint, nint, void>)&OnRunJavaScriptConfirm);
        WK.SetSlot(ui, WK.UIClient.RunJavaScriptPrompt, (nint)(delegate* unmanaged<nint, nint, nint, nint, nint, nint, nint, void>)&OnRunJavaScriptPrompt);
        WK.SetSlot(ui, WK.UIClient.RunBeforeUnloadConfirmPanel, (nint)(delegate* unmanaged<nint, nint, nint, nint, nint, void>)&OnRunBeforeUnloadConfirmPanel);
        WK.WKPageSetPageUIClient(_page, ui);

        var navigation = WK.CreateClient(WK.NavigationClient.Version, WK.NavigationClient.SlotCount, 0);
        WK.SetSlot(navigation, WK.NavigationClient.DecidePolicyForNavigationAction, (nint)(delegate* unmanaged<nint, nint, nint, nint, nint, void>)&OnDecidePolicyForNavigationAction);
        WK.SetSlot(navigation, WK.NavigationClient.DecidePolicyForNavigationResponse, (nint)(delegate* unmanaged<nint, nint, nint, nint, nint, void>)&OnDecidePolicyForNavigationResponse);
        WK.SetSlot(navigation, WK.NavigationClient.WebProcessDidTerminate, (nint)(delegate* unmanaged<nint, int, nint, void>)&OnWebProcessDidTerminate);
        WK.SetSlot(navigation, WK.NavigationClient.NavigationActionDidBecomeDownload, (nint)(delegate* unmanaged<nint, nint, nint, nint, void>)&OnDidBecomeDownload);
        WK.SetSlot(navigation, WK.NavigationClient.NavigationResponseDidBecomeDownload, (nint)(delegate* unmanaged<nint, nint, nint, nint, void>)&OnDidBecomeDownload);
        WK.WKPageSetPageNavigationClient(_page, navigation);

        var state = WK.CreateClient(WK.StateClient.Version, WK.StateClient.SlotCount, 0);
        WK.SetSlot(state, WK.StateClient.DidChangeTitle, (nint)(delegate* unmanaged<nint, void>)&OnDidChangeTitle);
        WK.WKPageSetPageStateClient(_page, state);

        _downloadClient = WK.CreateClient(WK.DownloadClient.Version, WK.DownloadClient.SlotCount, 0);
        WK.SetSlot(_downloadClient, WK.DownloadClient.DecideDestinationWithResponse, (nint)(delegate* unmanaged<nint, nint, nint, nint, nint>)&OnDecideDownloadDestination);
        WK.SetSlot(_downloadClient, WK.DownloadClient.DidFinish, (nint)(delegate* unmanaged<nint, nint, void>)&OnDownloadFinished);
        WK.SetSlot(_downloadClient, WK.DownloadClient.DidFailWithError, (nint)(delegate* unmanaged<nint, nint, nint, nint, void>)&OnDownloadFailed);
    }

    // ---- Public operations ---------------------------------------------------

    public void Navigate(string url)
    {
        using var wkUrl = new WK.Owned(WK.Url(url));
        WK.WKPageLoadURL(_page, wkUrl.Handle);
    }

    // Safe to call from any thread.
    public void RunOnUiThread(Action action)
    {
        lock (_queueGate)
            _queue.Enqueue(action);
        PostMessageW(_hwnd, WM_APP_RUN_QUEUED, 0, 0);
    }

    public void OpenFromBrowser(string url)
    {
        Navigate(url);
        BringToFront();
    }

    void BringToFront()
    {
        if (IsIconic(_hwnd) != 0)
            ShowWindow(_hwnd, SW_RESTORE);
        SetForegroundWindow(_hwnd);
        SetFocus(_viewHwnd);
    }

    // ---- Window procedure ----------------------------------------------------

    [UnmanagedCallersOnly]
    static nint WindowProc(nint hwnd, uint message, nint wParam, nint lParam)
    {
        var window = s_current;
        try
        {
            if (window is not null && window._hwnd != 0 && window.HandleMessage(hwnd, message, wParam, lParam, out var result))
                return result;
        }
        catch (Exception ex)
        {
            Log.Error($"Window message 0x{message:x} failed", ex);
        }
        return DefWindowProcW(hwnd, message, wParam, lParam);
    }

    bool HandleMessage(nint hwnd, uint message, nint wParam, nint lParam, out nint result)
    {
        result = 0;
        switch (message)
        {
            case WM_SIZE:
                LayoutView();
                return true;

            case WM_ERASEBKGND:
                RECT rect;
                GetClientRect(hwnd, &rect);
                FillRect(wParam, &rect, _backgroundBrush);
                result = 1;
                return true;

            case WM_ACTIVATE when LoWord(wParam) != 0:
            case WM_SETFOCUS:
                if (_viewHwnd != 0)
                    SetFocus(_viewHwnd);
                return true;

            case WM_GETMINMAXINFO:
                var dpi = GetDpiForWindow(hwnd);
                var info = (MINMAXINFO*)lParam;
                info->ptMinTrackSize.X = (int)(360 * dpi / 96);
                info->ptMinTrackSize.Y = (int)(480 * dpi / 96);
                return true;

            case WM_DPICHANGED:
                var suggested = (RECT*)lParam;
                SetWindowPos(hwnd, 0, suggested->Left, suggested->Top, suggested->Width, suggested->Height, SWP_NOZORDER | SWP_NOACTIVATE);
                return true;

            case WM_KEYDOWN:
            case WM_SYSKEYDOWN:
                return HandleShortcut((int)wParam, alt: message == WM_SYSKEYDOWN);

            case WM_APPCOMMAND:
                switch ((short)(HiWord(lParam) & ~0xF000))
                {
                    case APPCOMMAND_BROWSER_BACKWARD: WK.WKPageGoBack(_page); result = 1; return true;
                    case APPCOMMAND_BROWSER_FORWARD: WK.WKPageGoForward(_page); result = 1; return true;
                    case APPCOMMAND_BROWSER_REFRESH: WK.WKPageReload(_page); result = 1; return true;
                }
                return false;

            case WM_APP_RUN_QUEUED:
                RunQueued();
                return true;

            case TrayNotifications.CallbackMessage:
                HandleTrayMessage(lParam);
                return true;

            case WM_CLOSE:
                BeginClose();
                return true;

            case WM_TIMER when (nuint)wParam == CloseTimerId:
            case WM_APP_FINISH_CLOSE:
                KillTimer(hwnd, CloseTimerId);
                DestroyWindow(hwnd);
                return true;

            case WM_QUERYENDSESSION:
                result = 1;
                return true;

            case WM_ENDSESSION when wParam != 0:
                // Windows is signing out or shutting down and may end the
                // process as soon as this returns, so finish writing first.
                SavePlacement();
                _settings.Save();
                FlushStorage(TimeSpan.FromSeconds(2));
                return true;

            case WM_DESTROY:
                _tray?.Dispose();
                _tray = null;
                PostQuitMessage(0);
                return true;
        }
        return false;
    }

    // The engine's own window, subclassed for three things it does not do the
    // way the host needs.
    [UnmanagedCallersOnly]
    static nint ViewProc(nint hwnd, uint message, nint wParam, nint lParam)
    {
        var window = s_current;
        if (window is null)
            return DefWindowProcW(hwnd, message, wParam, lParam);
        try
        {
            switch (message)
            {
                case WM_SIZE:
                    // WebKit expects its size in device-independent pixels, but
                    // this build of the engine stopped dividing by the display
                    // scale. Without this, at 150% the page would lay out 1.5
                    // times wider than the window and be cut off.
                    var scale = GetDpiForWindow(hwnd) / 96.0;
                    if (scale > 0 && Math.Abs(scale - 1.0) > 0.001)
                        lParam = MakeLParam((int)Math.Ceiling(LoWord(lParam) / scale), (int)Math.Ceiling(HiWord(lParam) / scale));
                    break;

                case WM_MOUSEWHEEL when (LoWord(wParam) & MK_CONTROL) != 0:
                    // Ctrl + wheel and touchpad pinch zoom the page, as in a browser.
                    window._wheelZoomDelta += (short)HiWord(wParam);
                    while (window._wheelZoomDelta >= 120) { window.ZoomBy(+1); window._wheelZoomDelta -= 120; }
                    while (window._wheelZoomDelta <= -120) { window.ZoomBy(-1); window._wheelZoomDelta += 120; }
                    return 0;

                case WM_XBUTTONUP:
                    // Mouse back and forward buttons.
                    if (HiWord(wParam) == XBUTTON1) WK.WKPageGoBack(window._page);
                    else if (HiWord(wParam) == XBUTTON2) WK.WKPageGoForward(window._page);
                    return 1;
            }
        }
        catch (Exception ex)
        {
            Log.Error($"View message 0x{message:x} failed", ex);
        }
        return CallWindowProcW(window._viewProc, hwnd, message, wParam, lParam);
    }

    // Closing hides the window at once, then waits for the engine to write the
    // page's last storage changes before the process goes. Local-mode tasks
    // live in that storage, so a task ticked just before closing is kept.
    void BeginClose()
    {
        if (_closing)
            return;
        _closing = true;
        SavePlacement();
        ShowWindow(_hwnd, SW_HIDE);
        _tray?.Dispose();
        _tray = null;
        SetTimer(_hwnd, CloseTimerId, 3000, 0);
        WK.WKWebsiteDataStoreSyncLocalStorage(WK.WKPageGetWebsiteDataStore(_page), 0,
            (nint)(delegate* unmanaged<nint, void>)&OnStorageSyncedForClose);
    }

    [UnmanagedCallersOnly]
    static void OnStorageSyncedForClose(nint context)
    {
        if (s_current is { } window)
            PostMessageW(window._hwnd, WM_APP_FINISH_CLOSE, 0, 0);
    }

    static bool s_storageSynced;

    [UnmanagedCallersOnly]
    static void OnStorageSynced(nint context) => s_storageSynced = true;

    void FlushStorage(TimeSpan limit)
    {
        s_storageSynced = false;
        WK.WKWebsiteDataStoreSyncLocalStorage(WK.WKPageGetWebsiteDataStore(_page), 0,
            (nint)(delegate* unmanaged<nint, void>)&OnStorageSynced);
        var deadline = DateTime.UtcNow + limit;
        while (!s_storageSynced && DateTime.UtcNow < deadline)
        {
            WK.RunLoopCycle(0);
            Thread.Sleep(5);
        }
    }

    void LayoutView()
    {
        if (_viewHwnd == 0)
            return;
        RECT rect;
        GetClientRect(_hwnd, &rect);
        MoveWindow(_viewHwnd, 0, 0, rect.Width, rect.Height, 1);
    }

    bool HandleShortcut(int key, bool alt)
    {
        var ctrl = IsKeyDown(VK_CONTROL);
        var shift = IsKeyDown(VK_SHIFT);
        switch (key)
        {
            case VK_F5 when !alt:
            case VK_R when ctrl && !alt:
                if (shift || (key == VK_F5 && ctrl)) WK.WKPageReloadFromOrigin(_page);
                else WK.WKPageReload(_page);
                return true;
            case VK_BROWSER_REFRESH:
                WK.WKPageReload(_page);
                return true;
            case VK_LEFT when alt && !ctrl:
            case VK_BROWSER_BACK:
                WK.WKPageGoBack(_page);
                return true;
            case VK_RIGHT when alt && !ctrl:
            case VK_BROWSER_FORWARD:
                WK.WKPageGoForward(_page);
                return true;
            case VK_OEM_PLUS or VK_ADD when ctrl && !alt:
                ZoomBy(+1);
                return true;
            case VK_OEM_MINUS or VK_SUBTRACT when ctrl && !alt:
                ZoomBy(-1);
                return true;
            case VK_0 or VK_NUMPAD0 when ctrl && !alt:
                SetZoom(1.0);
                return true;
            case VK_F11 when !alt:
                ToggleFullscreen();
                return true;
            case VK_F12 when _options.DevTools:
            case VK_I when ctrl && shift && _options.DevTools:
                WK.WKInspectorShow(WK.WKPageGetInspector(_page));
                return true;
        }
        return false;
    }

    void ZoomBy(int direction)
    {
        var current = _settings.Zoom;
        var index = 0;
        for (var i = 0; i < ZoomSteps.Length; i++)
            if (Math.Abs(ZoomSteps[i] - current) < Math.Abs(ZoomSteps[index] - current))
                index = i;
        SetZoom(ZoomSteps[Math.Clamp(index + direction, 0, ZoomSteps.Length - 1)]);
    }

    void SetZoom(double zoom)
    {
        _settings.Zoom = zoom;
        WK.WKPageSetPageZoomFactor(_page, zoom);
    }

    void ToggleFullscreen()
    {
        var style = (uint)GetWindowLongPtrW(_hwnd, GWL_STYLE);
        if (!_fullscreen)
        {
            var placement = new WINDOWPLACEMENT { length = (uint)sizeof(WINDOWPLACEMENT) };
            GetWindowPlacement(_hwnd, &placement);
            _placementBeforeFullscreen = placement;
            var monitor = new MONITORINFO { cbSize = (uint)sizeof(MONITORINFO) };
            GetMonitorInfoW(MonitorFromWindow(_hwnd, MONITOR_DEFAULTTONEAREST), &monitor);
            SetWindowLongPtrW(_hwnd, GWL_STYLE, (nint)(style & ~WS_OVERLAPPEDWINDOW));
            SetWindowPos(_hwnd, 0, monitor.rcMonitor.Left, monitor.rcMonitor.Top, monitor.rcMonitor.Width, monitor.rcMonitor.Height,
                SWP_NOOWNERZORDER | SWP_FRAMECHANGED);
            _fullscreen = true;
        }
        else
        {
            SetWindowLongPtrW(_hwnd, GWL_STYLE, (nint)(style | WS_OVERLAPPEDWINDOW));
            var placement = _placementBeforeFullscreen;
            SetWindowPlacement(_hwnd, &placement);
            SetWindowPos(_hwnd, 0, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOOWNERZORDER | SWP_FRAMECHANGED);
            _fullscreen = false;
        }
    }

    // ---- Placement and theme -------------------------------------------------

    void RestorePlacement()
    {
        if (_settings.Window is { } saved && saved.Right - saved.Left >= 200 && saved.Bottom - saved.Top >= 200)
        {
            var rect = new RECT { Left = saved.Left, Top = saved.Top, Right = saved.Right, Bottom = saved.Bottom };
            if (MonitorFromRect(&rect, MONITOR_DEFAULTTONULL) != 0)
            {
                var placement = new WINDOWPLACEMENT { length = (uint)sizeof(WINDOWPLACEMENT), showCmd = SW_HIDE, rcNormalPosition = rect };
                SetWindowPlacement(_hwnd, &placement);
                return;
            }
        }

        // First launch: a comfortable size, centred in the work area.
        var monitor = new MONITORINFO { cbSize = (uint)sizeof(MONITORINFO) };
        GetMonitorInfoW(MonitorFromWindow(_hwnd, MONITOR_DEFAULTTONEAREST), &monitor);
        var scale = GetDpiForWindow(_hwnd) / 96.0;
        var width = Math.Min((int)(1280 * scale), (int)(monitor.rcWork.Width * 0.92));
        var height = Math.Min((int)(860 * scale), (int)(monitor.rcWork.Height * 0.92));
        SetWindowPos(_hwnd, 0,
            monitor.rcWork.Left + (monitor.rcWork.Width - width) / 2,
            monitor.rcWork.Top + (monitor.rcWork.Height - height) / 2,
            width, height, SWP_NOZORDER | SWP_NOACTIVATE);
    }

    void SavePlacement()
    {
        var placement = _placementBeforeFullscreen;
        if (!_fullscreen)
        {
            placement = new WINDOWPLACEMENT { length = (uint)sizeof(WINDOWPLACEMENT) };
            GetWindowPlacement(_hwnd, &placement);
        }
        _settings.Window = new WindowBounds
        {
            Left = placement.rcNormalPosition.Left,
            Top = placement.rcNormalPosition.Top,
            Right = placement.rcNormalPosition.Right,
            Bottom = placement.rcNormalPosition.Bottom,
            Maximized = placement.showCmd == SW_SHOWMAXIMIZED,
        };
    }

    void ApplyTheme(bool dark, uint colorRef)
    {
        var useDark = dark ? 1 : 0;
        DwmSetWindowAttribute(_hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, &useDark, sizeof(int));
        // Windows 11 only; Windows 10 ignores these and keeps the light or dark frame.
        var caption = colorRef;
        DwmSetWindowAttribute(_hwnd, DWMWA_CAPTION_COLOR, &caption, sizeof(uint));
        var text = dark ? Rgb(255, 255, 255) : Rgb(26, 26, 26);
        DwmSetWindowAttribute(_hwnd, DWMWA_TEXT_COLOR, &text, sizeof(uint));

        var brush = CreateSolidBrush(colorRef);
        if (_backgroundBrush != 0)
            DeleteObject(_backgroundBrush);
        _backgroundBrush = brush;
    }

    void HandleBridgeMessage(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        switch (root.GetProperty("type").GetString())
        {
            case "theme":
                var dark = root.GetProperty("dark").GetBoolean();
                if (TryParseCssColor(root.GetProperty("background").GetString() ?? "", out var colorRef, out var hex))
                {
                    ApplyTheme(dark, colorRef);
                    _settings.Dark = dark;
                    _settings.Background = hex;
                }
                break;

            case "error":
                Log.Warn($"Page script error: {root.GetProperty("message").GetString()} ({root.GetProperty("source").GetString()})");
                break;
        }
    }

    static bool TryParseCssColor(string css, out uint colorRef, out string hex)
    {
        colorRef = 0;
        hex = "";
        var open = css.IndexOf('(');
        var close = css.LastIndexOf(')');
        if (open < 0 || close <= open)
            return false;
        var parts = css[(open + 1)..close].Split([',', ' ', '/'], StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 3)
            return false;
        Span<byte> rgb = stackalloc byte[3];
        for (var i = 0; i < 3; i++)
        {
            if (!double.TryParse(parts[i], NumberStyles.Float, CultureInfo.InvariantCulture, out var value))
                return false;
            rgb[i] = (byte)Math.Clamp(Math.Round(value), 0, 255);
        }
        // A transparent body says nothing about what is on screen.
        if (parts.Length > 3 && double.TryParse(parts[3], NumberStyles.Float, CultureInfo.InvariantCulture, out var alpha) && alpha < 0.5)
            return false;
        colorRef = Rgb(rgb[0], rgb[1], rgb[2]);
        hex = $"#{rgb[0]:X2}{rgb[1]:X2}{rgb[2]:X2}";
        return true;
    }

    static uint ParseHexColor(string hex)
    {
        if (hex.Length == 7 && hex[0] == '#' && uint.TryParse(hex.AsSpan(1), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var value))
            return Rgb((byte)(value >> 16), (byte)(value >> 8), (byte)value);
        return Rgb(0xF8, 0xF7, 0xF5);
    }

    // ---- Queued work ---------------------------------------------------------

    void RunQueued()
    {
        while (true)
        {
            Action action;
            lock (_queueGate)
            {
                if (_queue.Count == 0)
                    return;
                action = _queue.Dequeue();
            }
            try
            {
                action();
            }
            catch (Exception ex)
            {
                Log.Error("Queued work failed", ex);
            }
        }
    }

    // ---- Notifications -------------------------------------------------------

    TrayNotifications Tray => _tray ??= new TrayNotifications(_hwnd, _smallIcon, _largeIcon);

    void HandleTrayMessage(nint lParam)
    {
        switch ((uint)LoWord(lParam))
        {
            case NIN_BALLOONUSERCLICK:
                var id = _tray?.CurrentId ?? 0;
                BringToFront();
                if (id != 0)
                    WK.WKNotificationManagerProviderDidClickNotification(_notificationManager, id);
                break;
            case NIN_SELECT:
            case NIN_KEYSELECT:
                BringToFront();
                break;
        }
    }

    [UnmanagedCallersOnly]
    static void OnShowNotification(nint page, nint notification, nint clientInfo) => Guard(nameof(OnShowNotification), () =>
    {
        var window = s_current!;
        var id = WK.WKNotificationGetID(notification);
        var title = WK.TakeString(WK.WKNotificationCopyTitle(notification));
        var body = WK.TakeString(WK.WKNotificationCopyBody(notification));
        window.Tray.Show(id, string.IsNullOrWhiteSpace(title) ? AppInfo.Name : title, body ?? "");
        WK.WKNotificationManagerProviderDidShowNotification(window._notificationManager, id);
    });

    [UnmanagedCallersOnly]
    static void OnCancelNotification(nint notification, nint clientInfo) => Guard(nameof(OnCancelNotification), () =>
        s_current!._tray?.Hide(WK.WKNotificationGetID(notification)));

    [UnmanagedCallersOnly]
    static void OnClearNotifications(nint notificationIds, nint clientInfo) => Guard(nameof(OnClearNotifications), () =>
        s_current!._tray?.HideAll());

    // WebKit adopts the dictionary returned here.
    [UnmanagedCallersOnly]
    static nint OnNotificationPermissions(nint clientInfo)
    {
        try
        {
            var window = s_current!;
            if (!window._settings.NotificationsAllowed)
                return 0;
            var permissions = WK.WKMutableDictionaryCreate();
            using var allowed = new WK.Owned(WK.WKBooleanCreate(1));
            foreach (var origin in new[] { window._server.Origin, $"http://localhost:{window._server.Port}" })
            {
                using var key = new WK.Owned(WK.String(origin));
                WK.WKDictionarySetItem(permissions, key.Handle, allowed.Handle);
            }
            return permissions;
        }
        catch (Exception ex)
        {
            Log.Error(nameof(OnNotificationPermissions), ex);
            return 0;
        }
    }

    // Windows decides whether an app may show notifications (Settings >
    // System > Notifications), so the page is not asked a second time.
    [UnmanagedCallersOnly]
    static void OnNotificationPermissionRequest(nint page, nint origin, nint request, nint clientInfo) => Guard(nameof(OnNotificationPermissionRequest), () =>
    {
        var window = s_current!;
        WK.WKNotificationPermissionRequestAllow(request);
        WK.WKNotificationManagerProviderDidUpdateNotificationPolicy(window._notificationManager, origin, 1);
        if (!window._settings.NotificationsAllowed)
        {
            window._settings.NotificationsAllowed = true;
            window._settings.Save();
        }
    });

    // ---- Page UI callbacks ---------------------------------------------------

    // window.close() from the page is ignored, as browsers do for a tab the
    // script did not open.
    [UnmanagedCallersOnly]
    static void OnPageClose(nint page, nint clientInfo) { }

    [UnmanagedCallersOnly]
    static void OnPageFocus(nint page, nint clientInfo) => Guard(nameof(OnPageFocus), () => s_current!.BringToFront());

    // Keys the page did not use go to the window, for shortcuts and Alt+F4.
    [UnmanagedCallersOnly]
    static void OnDidNotHandleKeyEvent(nint page, MSG* message, nint clientInfo)
    {
        var window = s_current;
        if (window is null || message is null)
            return;
        if (message->message is WM_KEYDOWN or WM_SYSKEYDOWN or WM_SYSCHAR)
            PostMessageW(window._hwnd, message->message, message->wParam, message->lParam);
    }

    [UnmanagedCallersOnly]
    static nint OnCreateNewPage(nint page, nint configuration, nint navigationAction, nint windowFeatures, nint clientInfo)
    {
        try
        {
            // Links meant for a new window open in the default browser, or in
            // this window when they point back into the app.
            var request = WK.WKNavigationActionCopyRequest(navigationAction);
            var url = WK.TakeUrl(WK.WKURLRequestCopyURL(request)) ?? "";
            WK.WKRelease(request);
            var window = s_current!;
            if (window.IsAppUrl(url))
                window.RunOnUiThread(() => window.Navigate(url));
            else
                OpenExternally(url);
        }
        catch (Exception ex)
        {
            Log.Error(nameof(OnCreateNewPage), ex);
        }
        return 0;
    }

    [UnmanagedCallersOnly]
    static void OnRunJavaScriptAlert(nint page, nint text, nint frame, nint securityOrigin, nint listener, nint clientInfo) => Guard(nameof(OnRunJavaScriptAlert), () =>
    {
        var window = s_current!;
        var message = WK.ToManaged(text) ?? "";
        WK.WKRetain(listener);
        window.RunOnUiThread(() =>
        {
            MessageBoxW(window._hwnd, message, AppInfo.Name, MB_OK | MB_ICONINFORMATION);
            WK.WKPageRunJavaScriptAlertResultListenerCall(listener);
            WK.WKRelease(listener);
        });
    });

    [UnmanagedCallersOnly]
    static void OnRunJavaScriptConfirm(nint page, nint text, nint frame, nint securityOrigin, nint listener, nint clientInfo) => Guard(nameof(OnRunJavaScriptConfirm), () =>
    {
        var window = s_current!;
        var message = WK.ToManaged(text) ?? "";
        WK.WKRetain(listener);
        window.RunOnUiThread(() =>
        {
            var ok = MessageBoxW(window._hwnd, message, AppInfo.Name, MB_OKCANCEL | MB_ICONWARNING) == IDOK;
            WK.WKPageRunJavaScriptConfirmResultListenerCall(listener, ok ? (byte)1 : (byte)0);
            WK.WKRelease(listener);
        });
    });

    // The website never calls prompt(); answering as if cancelled keeps the page from waiting forever.
    [UnmanagedCallersOnly]
    static void OnRunJavaScriptPrompt(nint page, nint text, nint defaultValue, nint frame, nint securityOrigin, nint listener, nint clientInfo) =>
        Guard(nameof(OnRunJavaScriptPrompt), () => WK.WKPageRunJavaScriptPromptResultListenerCall(listener, 0));

    [UnmanagedCallersOnly]
    static void OnRunBeforeUnloadConfirmPanel(nint page, nint text, nint frame, nint listener, nint clientInfo) =>
        Guard(nameof(OnRunBeforeUnloadConfirmPanel), () => WK.WKPageRunBeforeUnloadConfirmPanelResultListenerCall(listener, 1));

    [UnmanagedCallersOnly]
    static void OnRunOpenPanel(nint page, nint frame, nint parameters, nint listener, nint clientInfo) => Guard(nameof(OnRunOpenPanel), () =>
    {
        var window = s_current!;
        var multiple = WK.WKOpenPanelParametersGetAllowsMultipleFiles(parameters) != 0;
        var mimeTypes = WK.TakeStringArray(WK.WKOpenPanelParametersCopyAcceptedMIMETypes(parameters));
        var extensions = WK.TakeStringArray(WK.WKOpenPanelParametersCopyAcceptedFileExtensions(parameters));
        WK.WKRetain(listener);
        window.RunOnUiThread(() =>
        {
            try
            {
                var files = Dialogs.OpenFiles(window._hwnd, multiple, mimeTypes, extensions);
                if (files.Count == 0)
                {
                    WK.WKOpenPanelResultListenerCancel(listener);
                    return;
                }
                var urls = stackalloc nint[files.Count];
                for (var i = 0; i < files.Count; i++)
                    urls[i] = WK.Url(new Uri(files[i]).AbsoluteUri);
                using var fileUrls = new WK.Owned(WK.WKArrayCreateAdoptingValues(urls, (nuint)files.Count));
                using var noMimeTypes = new WK.Owned(WK.WKArrayCreateAdoptingValues(null, 0));
                WK.WKOpenPanelResultListenerChooseFiles(listener, fileUrls.Handle, noMimeTypes.Handle);
            }
            finally
            {
                WK.WKRelease(listener);
            }
        });
    });

    // ---- Navigation callbacks ------------------------------------------------

    bool IsAppUrl(string url) =>
        url.StartsWith(_server.Origin + "/", StringComparison.OrdinalIgnoreCase) ||
        url.StartsWith($"http://localhost:{_server.Port}/", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(url, _server.Origin, StringComparison.OrdinalIgnoreCase);

    static void OpenExternally(string url)
    {
        if (url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) ||
            url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            url.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase) ||
            url.StartsWith("tel:", StringComparison.OrdinalIgnoreCase))
        {
            Log.Info($"Opening in the default browser: {url}");
            ShellExecuteW(0, "open", url, null, null, SW_SHOWNORMAL);
        }
    }

    [UnmanagedCallersOnly]
    static void OnDecidePolicyForNavigationAction(nint page, nint action, nint listener, nint userData, nint clientInfo)
    {
        try
        {
            var window = s_current!;
            if (WK.WKNavigationActionShouldPerformDownload(action) != 0)
            {
                WK.WKFramePolicyListenerDownload(listener);
                return;
            }

            var request = WK.WKNavigationActionCopyRequest(action);
            var url = WK.TakeUrl(WK.WKURLRequestCopyURL(request)) ?? "";
            WK.WKRelease(request);

            if (window.IsAppUrl(url) || url.StartsWith("about:", StringComparison.OrdinalIgnoreCase) || url.StartsWith("blob:", StringComparison.OrdinalIgnoreCase))
            {
                WK.WKFramePolicyListenerUse(listener);
                return;
            }

            var target = WK.WKNavigationActionCopyTargetFrameInfo(action);
            var isMainFrame = target == 0 || WK.WKFrameInfoGetIsMainFrame(target) != 0;
            if (target != 0)
                WK.WKRelease(target);

            if (!isMainFrame)
            {
                WK.WKFramePolicyListenerUse(listener);
                return;
            }

            // The app window only ever shows the app. Anything else opens in the browser.
            OpenExternally(url);
            WK.WKFramePolicyListenerIgnore(listener);
        }
        catch (Exception ex)
        {
            Log.Error(nameof(OnDecidePolicyForNavigationAction), ex);
            WK.WKFramePolicyListenerIgnore(listener);
        }
    }

    [UnmanagedCallersOnly]
    static void OnDecidePolicyForNavigationResponse(nint page, nint response, nint listener, nint userData, nint clientInfo)
    {
        if (WK.WKNavigationResponseCanShowMIMEType(response) == 0)
            WK.WKFramePolicyListenerDownload(listener);
        else
            WK.WKFramePolicyListenerUse(listener);
    }

    [UnmanagedCallersOnly]
    static void OnWebProcessDidTerminate(nint page, int reason, nint clientInfo) => Guard(nameof(OnWebProcessDidTerminate), () =>
    {
        var window = s_current!;
        Log.Warn($"The page's web process ended (reason {reason}).");
        if (reason == WK.kWKProcessTerminationReasonRequestedByClient)
            return;

        // Reload, but do not spin if the page keeps crashing.
        if (DateTime.UtcNow - window._firstCrashAt > TimeSpan.FromMinutes(1))
        {
            window._firstCrashAt = DateTime.UtcNow;
            window._recentCrashes = 0;
        }
        if (++window._recentCrashes <= 3)
        {
            WK.WKPageReload(window._page);
            return;
        }

        // Reloading is not getting anywhere. Say so rather than leaving a
        // blank window with no explanation of what happened.
        Log.Error($"The page crashed {window._recentCrashes} times in a minute. Giving up on reloading it.");
        if (window._recentCrashes == 4)
            window.RunOnUiThread(() => MessageBoxW(window._hwnd,
                $"Bokeà keeps stopping and cannot reload itself.\n\nClose it and open it again. If it keeps happening, the details are in {Path.Combine(Paths.Logs, "bokea.log")}.",
                AppInfo.Name, MB_OK | MB_ICONERROR));
    });

    [UnmanagedCallersOnly]
    static void OnDidChangeTitle(nint clientInfo) => Guard(nameof(OnDidChangeTitle), () =>
    {
        var window = s_current!;
        var title = WK.TakeString(WK.WKPageCopyTitle(window._page));
        SetWindowTextW(window._hwnd, string.IsNullOrWhiteSpace(title) ? AppInfo.Name : title);
    });

    // ---- Downloads -----------------------------------------------------------

    [UnmanagedCallersOnly]
    static void OnDidBecomeDownload(nint page, nint navigationActionOrResponse, nint download, nint clientInfo)
    {
        var window = s_current;
        if (window is not null)
            WK.WKDownloadSetClient(download, window._downloadClient);
    }

    // Saved straight to the Downloads folder, as a browser does, so the
    // website's "Look in your downloads" stays true. WebKit adopts the string.
    [UnmanagedCallersOnly]
    static nint OnDecideDownloadDestination(nint download, nint response, nint suggestedFilename, nint clientInfo)
    {
        try
        {
            var path = Downloads.UniquePath(Downloads.Folder(), WK.ToManaged(suggestedFilename));
            Log.Info($"Saving download to {path}");
            return WK.String(path);
        }
        catch (Exception ex)
        {
            Log.Error(nameof(OnDecideDownloadDestination), ex);
            return 0;
        }
    }

    [UnmanagedCallersOnly]
    static void OnDownloadFinished(nint download, nint clientInfo) => Log.Info("Download finished.");

    [UnmanagedCallersOnly]
    static void OnDownloadFailed(nint download, nint error, nint resumeData, nint clientInfo) =>
        Log.Warn($"Download failed: {WK.TakeString(WK.WKErrorCopyLocalizedDescription(error))}");

    // ---- Bridge ----------------------------------------------------------------

    [UnmanagedCallersOnly]
    static void OnScriptMessage(nint message, nint reply, nint context)
    {
        try
        {
            var body = WK.WKScriptMessageGetBody(message);
            if (WK.IsString(body) && WK.ToManaged(body) is { } json)
                s_current?.HandleBridgeMessage(json);
        }
        catch (Exception ex)
        {
            Log.Error(nameof(OnScriptMessage), ex);
        }
        finally
        {
            if (reply != 0)
            {
                using var empty = new WK.Owned(WK.String(""));
                WK.WKCompletionListenerComplete(reply, empty.Handle);
            }
        }
    }

    static void Guard(string name, Action action)
    {
        try
        {
            action();
        }
        catch (Exception ex)
        {
            Log.Error(name, ex);
        }
    }
}
