using System.Net.Sockets;
using System.Reflection;
using System.Runtime.InteropServices;
using Bokea.Desktop.Native;
using static Bokea.Desktop.Native.Win32;

namespace Bokea.Desktop;

internal static class Program
{
    [STAThread]
    static int Main(string[] args)
    {
        // Nothing is logged until the data folder exists, so until then a
        // message box is all the user gets.
        Options options;
        try
        {
            options = Options.Parse(args);
        }
        catch (Exception ex)
        {
            ShowError($"Bokeà could not understand the options it was started with.\n\n{ex.Message}");
            return 1;
        }
        try
        {
            Paths.Init(options.DataDirectory);
        }
        catch (Exception ex)
        {
            ShowError($"Bokeà could not create its data folder.\n\n{ex.Message}");
            return 1;
        }
        Log.Init(Paths.Logs);
        Log.Info($"{AppInfo.Name} {AppInfo.Version} starting on {Environment.OSVersion}");
        AppDomain.CurrentDomain.UnhandledException += (_, e) => Log.Error("Unhandled exception", e.ExceptionObject as Exception);

        // One window at a time. Opening Bokeà again brings the open one forward.
        var mutex = CreateMutexW(0, 0, $"Local\\{AppInfo.AppUserModelId}.{options.Port}");
        if (Marshal.GetLastPInvokeError() == ERROR_ALREADY_EXISTS)
        {
            ActivateRunningInstance();
            return 0;
        }

        SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        SetCurrentProcessExplicitAppUserModelID(AppInfo.AppUserModelId);
        OleInitialize(0);

        if (!File.Exists(Path.Combine(Paths.Runtime, "WebKit2.dll")) || !File.Exists(Path.Combine(Paths.Web, "index.html")))
        {
            ShowError("Bokeà is missing some of its files. Please install it again.");
            return 1;
        }

        // The engine lives in runtime\. Its DLLs find each other there, and it
        // starts its helper processes from the folder WebKit2.dll was loaded from.
        SetDllDirectoryW(Paths.Runtime);
        NativeLibrary.SetDllImportResolver(typeof(Program).Assembly, ResolveEngineLibrary);

        var settings = Settings.Load();
        using var server = new AppServer(Paths.Web, options.Port, AppInfo.ReadResource("handoff.js"));
        try
        {
            server.Start();
        }
        catch (SocketException ex)
        {
            Log.Error("The app server could not start", ex);
            ShowError($"Bokeà could not start because another program on this computer is using port {options.Port}.\n\nClose that program, then open Bokeà again.");
            return 1;
        }

        var window = new AppWindow(settings, options, server);
        try
        {
            window.Create();
        }
        catch (Exception ex)
        {
            Log.Error("The window could not be created", ex);
            ShowError($"Bokeà could not start its display engine.\n\nDetails are in {Path.Combine(Paths.Logs, "bokea.log")}");
            return 1;
        }

        server.HandoffReceived = url => window.RunOnUiThread(() => window.OpenFromBrowser(url));
        window.Navigate(server.Origin + options.StartPath);

        WK.RunLoopRun();

        settings.Save();
        Log.Info("Closed.");
        GC.KeepAlive(mutex);
        return 0;
    }

    static nint ResolveEngineLibrary(string name, Assembly assembly, DllImportSearchPath? searchPath) =>
        name is "WebKit2.dll" or "JavaScriptCore.dll"
            ? NativeLibrary.Load(Path.Combine(Paths.Runtime, name))
            : 0;

    static void ActivateRunningInstance()
    {
        var hwnd = FindWindowW(AppInfo.WindowClass, null);
        if (hwnd == 0)
            return;
        if (IsIconic(hwnd) != 0)
            ShowWindow(hwnd, SW_RESTORE);
        SetForegroundWindow(hwnd);
    }

    static void ShowError(string message)
    {
        Log.Error(message);
        MessageBoxW(0, message, AppInfo.Name, MB_OK | MB_ICONERROR | MB_SETFOREGROUND);
    }
}
