using System.Runtime.InteropServices;
using System.Text;

namespace Bokea.Desktop.Native;

// Bindings for the WebKit C API (WebKit2.dll) at the pinned engine revision.
//
// Client structs are laid out by hand: a { int version; void* clientInfo; }
// header followed by one function pointer per slot. The slot numbers below
// were generated from the C headers at the engine's base revision, including
// the one field Playwright's build adds to WKPageUIClient, by
// tools/webkit-slots.py. If the engine is ever updated, regenerate them.
internal static unsafe partial class WK
{
    const string WebKit2 = "WebKit2.dll";
    const string JavaScriptCore = "JavaScriptCore.dll";

    public const int kWKInjectAtDocumentStart = 0;
    public const uint kWKDidFirstVisuallyNonEmptyLayout = 1 << 1;
    public const int kWKProcessTerminationReasonRequestedByClient = 2;

    public static class UIClient
    {
        public const int Version = 14;
        public const int SlotCount = 74;
        public const int Close = 2;
        public const int Focus = 4;
        public const int DidNotHandleKeyEvent = 12;
        public const int RunOpenPanel = 28;
        public const int DecidePolicyForNotificationPermissionRequest = 41;
        public const int CreateNewPage = 57;
        public const int RunJavaScriptAlert = 58;
        public const int RunJavaScriptConfirm = 59;
        public const int RunJavaScriptPrompt = 60;
        public const int RunBeforeUnloadConfirmPanel = 62;
    }

    public static class NavigationClient
    {
        public const int Version = 3;
        public const int SlotCount = 27;
        public const int DecidePolicyForNavigationAction = 0;
        public const int DecidePolicyForNavigationResponse = 1;
        public const int DidFinishNavigation = 7;
        public const int RenderingProgressDidChange = 12;
        public const int WebProcessDidTerminate = 21;
        public const int NavigationActionDidBecomeDownload = 24;
        public const int NavigationResponseDidBecomeDownload = 25;
    }

    public static class StateClient
    {
        public const int Version = 0;
        public const int SlotCount = 21;
        public const int DidChangeTitle = 3;
    }

    public static class NotificationProvider
    {
        public const int Version = 0;
        public const int SlotCount = 7;
        public const int Show = 0;
        public const int Cancel = 1;
        public const int NotificationPermissions = 5;
        public const int ClearNotifications = 6;
    }

    public static class DownloadClient
    {
        public const int Version = 0;
        public const int SlotCount = 6;
        public const int DecideDestinationWithResponse = 2;
        public const int DidFinish = 4;
        public const int DidFailWithError = 5;
    }

    // Clients are copied by WebKit when installed, but they are tiny and made
    // once, so they simply live for the life of the process.
    public static nint CreateClient(int version, int slotCount, nint clientInfo)
    {
        var client = (nint)NativeMemory.AllocZeroed((nuint)(16 + 8 * slotCount));
        *(int*)client = version;
        *(nint*)(client + 8) = clientInfo;
        return client;
    }

    public static void SetSlot(nint client, int slot, nint function) => *(nint*)(client + 16 + 8 * slot) = function;

    // ---- Owned references ----------------------------------------------------
    public readonly struct Owned(nint handle) : IDisposable
    {
        public nint Handle { get; } = handle;
        public void Dispose()
        {
            if (Handle != 0)
                WKRelease(Handle);
        }
    }

    public static nint String(string value)
    {
        var bytes = Encoding.UTF8.GetBytes(value + "\0");
        fixed (byte* p = bytes)
            return WKStringCreateWithUTF8CString(p);
    }

    public static nint Url(string value)
    {
        var bytes = Encoding.UTF8.GetBytes(value + "\0");
        fixed (byte* p = bytes)
            return WKURLCreateWithUTF8CString(p);
    }

    public static string? ToManaged(nint wkString)
    {
        if (wkString == 0)
            return null;
        var capacity = (int)WKStringGetMaximumUTF8CStringSize(wkString);
        if (capacity <= 0)
            return "";
        var buffer = capacity <= 4096 ? stackalloc byte[capacity] : new byte[capacity];
        fixed (byte* p = buffer)
        {
            var written = (int)WKStringGetUTF8CString(wkString, p, (nuint)capacity);
            var span = buffer[..Math.Min(written, capacity)];
            var end = span.IndexOf((byte)0);
            return Encoding.UTF8.GetString(end < 0 ? span : span[..end]);
        }
    }

    // For the "Copy" functions, whose result the caller owns.
    public static string? TakeString(nint wkString)
    {
        try { return ToManaged(wkString); }
        finally { if (wkString != 0) WKRelease(wkString); }
    }

    public static string? TakeUrl(nint wkUrl)
    {
        if (wkUrl == 0)
            return null;
        var text = WKURLCopyString(wkUrl);
        WKRelease(wkUrl);
        return TakeString(text);
    }

    public static List<string> TakeStringArray(nint array)
    {
        var result = new List<string>();
        if (array == 0)
            return result;
        var count = (int)WKArrayGetSize(array);
        for (var i = 0; i < count; i++)
        {
            var item = WKArrayGetItemAtIndex(array, (nuint)i);
            if (IsString(item) && ToManaged(item) is { Length: > 0 } text)
                result.Add(text);
        }
        WKRelease(array);
        return result;
    }

    public static bool IsString(nint obj) => obj != 0 && WKGetTypeID(obj) == WKStringGetTypeID();

    // ---- Types ---------------------------------------------------------------
    [LibraryImport(WebKit2)] public static partial void WKRelease(nint obj);
    [LibraryImport(WebKit2)] public static partial nint WKRetain(nint obj);
    [LibraryImport(WebKit2)] public static partial uint WKGetTypeID(nint obj);
    [LibraryImport(WebKit2)] public static partial uint WKStringGetTypeID();
    [LibraryImport(WebKit2)] public static partial nint WKStringCreateWithUTF8CString(byte* text);
    [LibraryImport(WebKit2)] public static partial nuint WKStringGetMaximumUTF8CStringSize(nint wkString);
    [LibraryImport(WebKit2)] public static partial nuint WKStringGetUTF8CString(nint wkString, byte* buffer, nuint bufferSize);
    [LibraryImport(WebKit2)] public static partial nint WKURLCreateWithUTF8CString(byte* text);
    [LibraryImport(WebKit2)] public static partial nint WKURLCopyString(nint url);
    [LibraryImport(WebKit2)] public static partial nint WKArrayCreateAdoptingValues(nint* values, nuint count);
    [LibraryImport(WebKit2)] public static partial nuint WKArrayGetSize(nint array);
    [LibraryImport(WebKit2)] public static partial nint WKArrayGetItemAtIndex(nint array, nuint index);
    [LibraryImport(WebKit2)] public static partial nint WKBooleanCreate(byte value);
    [LibraryImport(WebKit2)] public static partial nint WKMutableDictionaryCreate();
    [LibraryImport(WebKit2)] public static partial byte WKDictionarySetItem(nint dictionary, nint key, nint item);
    [LibraryImport(WebKit2)] public static partial nint WKErrorCopyLocalizedDescription(nint error);

    // ---- Context, storage, preferences ---------------------------------------
    [LibraryImport(WebKit2)] public static partial nint WKContextConfigurationCreate();
    [LibraryImport(WebKit2)] public static partial nint WKContextCreateWithConfiguration(nint configuration);
    [LibraryImport(WebKit2)] public static partial nint WKWebsiteDataStoreConfigurationCreate();
    [LibraryImport(WebKit2)] public static partial void WKWebsiteDataStoreConfigurationSetGeneralStorageDirectory(nint configuration, nint directory);
    [LibraryImport(WebKit2)] public static partial void WKWebsiteDataStoreConfigurationSetLocalStorageDirectory(nint configuration, nint directory);
    [LibraryImport(WebKit2)] public static partial void WKWebsiteDataStoreConfigurationSetIndexedDBDatabaseDirectory(nint configuration, nint directory);
    [LibraryImport(WebKit2)] public static partial void WKWebsiteDataStoreConfigurationSetCacheStorageDirectory(nint configuration, nint directory);
    [LibraryImport(WebKit2)] public static partial void WKWebsiteDataStoreConfigurationSetNetworkCacheDirectory(nint configuration, nint directory);
    [LibraryImport(WebKit2)] public static partial void WKWebsiteDataStoreConfigurationSetServiceWorkerRegistrationDirectory(nint configuration, nint directory);
    [LibraryImport(WebKit2)] public static partial void WKWebsiteDataStoreConfigurationSetMediaKeysStorageDirectory(nint configuration, nint directory);
    [LibraryImport(WebKit2)] public static partial void WKWebsiteDataStoreConfigurationSetResourceLoadStatisticsDirectory(nint configuration, nint directory);
    [LibraryImport(WebKit2)] public static partial void WKWebsiteDataStoreConfigurationSetWebSQLDatabaseDirectory(nint configuration, nint directory);
    [LibraryImport(WebKit2)] public static partial void WKWebsiteDataStoreConfigurationSetCookieStorageFile(nint configuration, nint file);
    [LibraryImport(WebKit2)] public static partial nint WKWebsiteDataStoreCreateWithConfiguration(nint configuration);
    [LibraryImport(WebKit2)] public static partial nint WKPageGetWebsiteDataStore(nint page);
    [LibraryImport(WebKit2)] public static partial void WKWebsiteDataStoreSyncLocalStorage(nint dataStore, nint context, nint callback);
    [LibraryImport(WebKit2)] public static partial nint WKPreferencesCreate();
    [LibraryImport(WebKit2)] public static partial void WKPreferencesSetNotificationsEnabled(nint preferences, byte enabled);
    [LibraryImport(WebKit2)] public static partial void WKPreferencesSetDeveloperExtrasEnabled(nint preferences, byte enabled);
    [LibraryImport(WebKit2)] public static partial void WKPreferencesSetDownloadAttributeEnabled(nint preferences, byte enabled);
    [LibraryImport(WebKit2)] public static partial nint WKUserContentControllerCreate();
    [LibraryImport(WebKit2)] public static partial void WKUserContentControllerAddUserScript(nint controller, nint script);
    [LibraryImport(WebKit2)] public static partial void WKUserContentControllerAddScriptMessageHandler(nint controller, nint name, nint callback, nint context);
    [LibraryImport(WebKit2)] public static partial nint WKUserScriptCreateWithSource(nint source, int injectionTime, byte forMainFrameOnly);
    [LibraryImport(WebKit2)] public static partial nint WKScriptMessageGetBody(nint message);
    [LibraryImport(WebKit2)] public static partial void WKCompletionListenerComplete(nint listener, nint result);
    [LibraryImport(WebKit2)] public static partial nint WKPageConfigurationCreate();
    [LibraryImport(WebKit2)] public static partial void WKPageConfigurationSetContext(nint configuration, nint context);
    [LibraryImport(WebKit2)] public static partial void WKPageConfigurationSetWebsiteDataStore(nint configuration, nint dataStore);
    [LibraryImport(WebKit2)] public static partial void WKPageConfigurationSetPreferences(nint configuration, nint preferences);
    [LibraryImport(WebKit2)] public static partial void WKPageConfigurationSetUserContentController(nint configuration, nint controller);

    // ---- View and page -------------------------------------------------------
    [LibraryImport(WebKit2)] public static partial nint WKViewCreate(Win32.RECT rect, nint configuration, nint parentWindow);
    [LibraryImport(WebKit2)] public static partial nint WKViewGetWindow(nint view);
    [LibraryImport(WebKit2)] public static partial nint WKViewGetPage(nint view);
    [LibraryImport(WebKit2)] public static partial void WKViewSetIsInWindow(nint view, byte isInWindow);
    [LibraryImport(WebKit2)] public static partial void WKPageLoadURL(nint page, nint url);
    [LibraryImport(WebKit2)] public static partial void WKPageReload(nint page);
    [LibraryImport(WebKit2)] public static partial void WKPageReloadFromOrigin(nint page);
    [LibraryImport(WebKit2)] public static partial void WKPageGoBack(nint page);
    [LibraryImport(WebKit2)] public static partial void WKPageGoForward(nint page);
    [LibraryImport(WebKit2)] public static partial void WKPageSetPageZoomFactor(nint page, double zoomFactor);
    [LibraryImport(WebKit2)] public static partial void WKPageSetApplicationNameForUserAgent(nint page, nint applicationName);
    [LibraryImport(WebKit2)] public static partial void WKPageSetPageUIClient(nint page, nint client);
    [LibraryImport(WebKit2)] public static partial void WKPageSetPageNavigationClient(nint page, nint client);
    [LibraryImport(WebKit2)] public static partial void WKPageSetPageStateClient(nint page, nint client);
    [LibraryImport(WebKit2)] public static partial nint WKPageCopyTitle(nint page);
    [LibraryImport(WebKit2)] public static partial nint WKPageGetInspector(nint page);
    [LibraryImport(WebKit2)] public static partial void WKInspectorShow(nint inspector);

    // ---- Navigation and downloads --------------------------------------------
    [LibraryImport(WebKit2)] public static partial nint WKNavigationActionCopyRequest(nint action);
    [LibraryImport(WebKit2)] public static partial byte WKNavigationActionShouldPerformDownload(nint action);
    [LibraryImport(WebKit2)] public static partial nint WKNavigationActionCopyTargetFrameInfo(nint action);
    [LibraryImport(WebKit2)] public static partial byte WKFrameInfoGetIsMainFrame(nint frameInfo);
    [LibraryImport(WebKit2)] public static partial nint WKURLRequestCopyURL(nint request);
    [LibraryImport(WebKit2)] public static partial void WKFramePolicyListenerUse(nint listener);
    [LibraryImport(WebKit2)] public static partial void WKFramePolicyListenerIgnore(nint listener);
    [LibraryImport(WebKit2)] public static partial void WKFramePolicyListenerDownload(nint listener);
    [LibraryImport(WebKit2)] public static partial byte WKNavigationResponseCanShowMIMEType(nint response);
    [LibraryImport(WebKit2)] public static partial void WKDownloadSetClient(nint download, nint client);

    // ---- JavaScript dialogs and file choosers --------------------------------
    [LibraryImport(WebKit2)] public static partial void WKPageRunJavaScriptAlertResultListenerCall(nint listener);
    [LibraryImport(WebKit2)] public static partial void WKPageRunJavaScriptConfirmResultListenerCall(nint listener, byte result);
    [LibraryImport(WebKit2)] public static partial void WKPageRunJavaScriptPromptResultListenerCall(nint listener, nint result);
    [LibraryImport(WebKit2)] public static partial void WKPageRunBeforeUnloadConfirmPanelResultListenerCall(nint listener, byte result);
    [LibraryImport(WebKit2)] public static partial byte WKOpenPanelParametersGetAllowsMultipleFiles(nint parameters);
    [LibraryImport(WebKit2)] public static partial nint WKOpenPanelParametersCopyAcceptedMIMETypes(nint parameters);
    [LibraryImport(WebKit2)] public static partial nint WKOpenPanelParametersCopyAcceptedFileExtensions(nint parameters);
    [LibraryImport(WebKit2)] public static partial void WKOpenPanelResultListenerChooseFiles(nint listener, nint fileUrls, nint allowedMimeTypes);
    [LibraryImport(WebKit2)] public static partial void WKOpenPanelResultListenerCancel(nint listener);

    // ---- Notifications -------------------------------------------------------
    [LibraryImport(WebKit2)] public static partial nint WKContextGetNotificationManager(nint context);
    [LibraryImport(WebKit2)] public static partial void WKNotificationManagerSetProvider(nint manager, nint provider);
    [LibraryImport(WebKit2)] public static partial void WKNotificationManagerProviderDidShowNotification(nint manager, ulong notificationId);
    [LibraryImport(WebKit2)] public static partial void WKNotificationManagerProviderDidClickNotification(nint manager, ulong notificationId);
    [LibraryImport(WebKit2)] public static partial void WKNotificationManagerProviderDidUpdateNotificationPolicy(nint manager, nint origin, byte allowed);
    [LibraryImport(WebKit2)] public static partial ulong WKNotificationGetID(nint notification);
    [LibraryImport(WebKit2)] public static partial nint WKNotificationCopyTitle(nint notification);
    [LibraryImport(WebKit2)] public static partial nint WKNotificationCopyBody(nint notification);
    [LibraryImport(WebKit2)] public static partial void WKNotificationPermissionRequestAllow(nint request);

    // ---- The engine's run loop -------------------------------------------------
    // WebKit's timers only fire from inside WTF::RunLoop::run(), so the host's
    // message loop has to be that one rather than a plain GetMessage loop.
    [LibraryImport(JavaScriptCore, EntryPoint = "?run@RunLoop@WTF@@SAXXZ")]
    public static partial void RunLoopRun();

    // One pass of the same loop: fires due timers and handles waiting messages.
    [LibraryImport(JavaScriptCore, EntryPoint = "?cycle@RunLoop@WTF@@SA?AW4CycleResult@12@I@Z")]
    public static partial int RunLoopCycle(uint mode);
}
