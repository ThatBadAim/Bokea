using System.Runtime.InteropServices;

namespace Bokea.Desktop.Native;

// The Win32 surface the host uses, and nothing more. BOOL comes back as int
// so no marshalling code has to be generated for it.
internal static unsafe partial class Win32
{
    // ---- Window messages ----------------------------------------------------
    public const uint WM_DESTROY = 0x0002;
    public const uint WM_SIZE = 0x0005;
    public const uint WM_ACTIVATE = 0x0006;
    public const uint WM_SETFOCUS = 0x0007;
    public const uint WM_CLOSE = 0x0010;
    public const uint WM_QUERYENDSESSION = 0x0011;
    public const uint WM_ENDSESSION = 0x0016;
    public const uint WM_ERASEBKGND = 0x0014;
    public const uint WM_TIMER = 0x0113;
    public const uint WM_GETMINMAXINFO = 0x0024;
    public const uint WM_KEYDOWN = 0x0100;
    public const uint WM_SYSKEYDOWN = 0x0104;
    public const uint WM_SYSCHAR = 0x0106;
    public const uint WM_MOUSEWHEEL = 0x020A;
    public const uint WM_XBUTTONDOWN = 0x020B;
    public const uint WM_XBUTTONUP = 0x020C;
    public const uint WM_DPICHANGED = 0x02E0;
    public const uint WM_APPCOMMAND = 0x0319;
    public const uint WM_USER = 0x0400;
    public const uint WM_APP = 0x8000;

    // ---- Styles, commands, flags --------------------------------------------
    public const uint WS_OVERLAPPEDWINDOW = 0x00CF0000;
    public const uint WS_POPUP = 0x80000000;
    public const uint WS_VISIBLE = 0x10000000;
    public const uint WS_CLIPCHILDREN = 0x02000000;
    public const uint CS_HREDRAW = 0x0002;
    public const uint CS_VREDRAW = 0x0001;
    public const int CW_USEDEFAULT = unchecked((int)0x80000000);

    public const int SW_HIDE = 0;
    public const int SW_SHOWNORMAL = 1;
    public const int SW_SHOWMAXIMIZED = 3;
    public const int SW_SHOW = 5;
    public const int SW_RESTORE = 9;

    public const int GWL_STYLE = -16;
    public const int GWLP_WNDPROC = -4;

    public const uint SWP_NOSIZE = 0x0001;
    public const uint SWP_NOMOVE = 0x0002;
    public const uint SWP_NOZORDER = 0x0004;
    public const uint SWP_NOACTIVATE = 0x0010;
    public const uint SWP_FRAMECHANGED = 0x0020;
    public const uint SWP_NOOWNERZORDER = 0x0200;

    public const uint MONITOR_DEFAULTTONULL = 0;
    public const uint MONITOR_DEFAULTTONEAREST = 2;

    public const uint MB_OK = 0x0;
    public const uint MB_OKCANCEL = 0x1;
    public const uint MB_ICONERROR = 0x10;
    public const uint MB_ICONWARNING = 0x30;
    public const uint MB_ICONINFORMATION = 0x40;
    public const uint MB_SETFOREGROUND = 0x10000;
    public const int IDOK = 1;

    public const uint IMAGE_ICON = 1;
    public const uint LR_DEFAULTCOLOR = 0;
    public const uint LR_SHARED = 0x8000;
    public const int IDC_ARROW = 32512;
    // .NET embeds <ApplicationIcon> under the IDI_APPLICATION resource id.
    public const int APP_ICON_RESOURCE = 32512;

    public const int MK_CONTROL = 0x0008;
    public const int XBUTTON1 = 0x0001;
    public const int XBUTTON2 = 0x0002;
    public const int APPCOMMAND_BROWSER_BACKWARD = 1;
    public const int APPCOMMAND_BROWSER_FORWARD = 2;
    public const int APPCOMMAND_BROWSER_REFRESH = 3;

    public const int VK_SHIFT = 0x10;
    public const int VK_CONTROL = 0x11;
    public const int VK_MENU = 0x12;
    public const int VK_LEFT = 0x25;
    public const int VK_RIGHT = 0x27;
    public const int VK_0 = 0x30;
    public const int VK_I = 0x49;
    public const int VK_R = 0x52;
    public const int VK_NUMPAD0 = 0x60;
    public const int VK_ADD = 0x6B;
    public const int VK_SUBTRACT = 0x6D;
    public const int VK_F5 = 0x74;
    public const int VK_F11 = 0x7A;
    public const int VK_F12 = 0x7B;
    public const int VK_BROWSER_BACK = 0xA6;
    public const int VK_BROWSER_FORWARD = 0xA7;
    public const int VK_BROWSER_REFRESH = 0xA8;
    public const int VK_OEM_PLUS = 0xBB;
    public const int VK_OEM_MINUS = 0xBD;

    public const int ERROR_ALREADY_EXISTS = 183;
    public static readonly nint DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = -4;

    public const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
    public const int DWMWA_BORDER_COLOR = 34;
    public const int DWMWA_CAPTION_COLOR = 35;
    public const int DWMWA_TEXT_COLOR = 36;

    // ---- Notification area ---------------------------------------------------
    public const uint NIM_ADD = 0x0;
    public const uint NIM_MODIFY = 0x1;
    public const uint NIM_DELETE = 0x2;
    public const uint NIM_SETVERSION = 0x4;
    public const uint NIF_MESSAGE = 0x01;
    public const uint NIF_ICON = 0x02;
    public const uint NIF_TIP = 0x04;
    public const uint NIF_INFO = 0x10;
    public const uint NIF_SHOWTIP = 0x80;
    public const uint NIIF_USER = 0x04;
    public const uint NIIF_LARGE_ICON = 0x20;
    public const uint NOTIFYICON_VERSION_4 = 4;
    public const uint NIN_SELECT = WM_USER + 0;
    public const uint NIN_KEYSELECT = WM_USER + 1;
    public const uint NIN_BALLOONHIDE = WM_USER + 3;
    public const uint NIN_BALLOONTIMEOUT = WM_USER + 4;
    public const uint NIN_BALLOONUSERCLICK = WM_USER + 5;

    // ---- Common dialogs ------------------------------------------------------
    public const uint OFN_HIDEREADONLY = 0x00000004;
    public const uint OFN_NOCHANGEDIR = 0x00000008;
    public const uint OFN_ALLOWMULTISELECT = 0x00000200;
    public const uint OFN_PATHMUSTEXIST = 0x00000800;
    public const uint OFN_FILEMUSTEXIST = 0x00001000;
    public const uint OFN_EXPLORER = 0x00080000;

    public static readonly Guid FOLDERID_Downloads = new("374DE290-123F-4565-9164-39C4925E467B");

    // ---- Structures ----------------------------------------------------------
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left, Top, Right, Bottom;
        public readonly int Width => Right - Left;
        public readonly int Height => Bottom - Top;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT
    {
        public int X, Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSG
    {
        public nint hwnd;
        public uint message;
        public nint wParam;
        public nint lParam;
        public uint time;
        public POINT pt;
        public uint lPrivate;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MINMAXINFO
    {
        public POINT ptReserved, ptMaxSize, ptMaxPosition, ptMinTrackSize, ptMaxTrackSize;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct WINDOWPLACEMENT
    {
        public uint length, flags, showCmd;
        public POINT ptMinPosition, ptMaxPosition;
        public RECT rcNormalPosition;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MONITORINFO
    {
        public uint cbSize;
        public RECT rcMonitor, rcWork;
        public uint dwFlags;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct WNDCLASSEXW
    {
        public uint cbSize;
        public uint style;
        public delegate* unmanaged<nint, uint, nint, nint, nint> lpfnWndProc;
        public int cbClsExtra;
        public int cbWndExtra;
        public nint hInstance;
        public nint hIcon;
        public nint hCursor;
        public nint hbrBackground;
        public char* lpszMenuName;
        public char* lpszClassName;
        public nint hIconSm;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct NOTIFYICONDATAW
    {
        public uint cbSize;
        public nint hWnd;
        public uint uID;
        public uint uFlags;
        public uint uCallbackMessage;
        public nint hIcon;
        public fixed char szTip[128];
        public uint dwState;
        public uint dwStateMask;
        public fixed char szInfo[256];
        public uint uVersion;
        public fixed char szInfoTitle[64];
        public uint dwInfoFlags;
        public Guid guidItem;
        public nint hBalloonIcon;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct OPENFILENAMEW
    {
        public uint lStructSize;
        public nint hwndOwner;
        public nint hInstance;
        public char* lpstrFilter;
        public char* lpstrCustomFilter;
        public uint nMaxCustFilter;
        public uint nFilterIndex;
        public char* lpstrFile;
        public uint nMaxFile;
        public char* lpstrFileTitle;
        public uint nMaxFileTitle;
        public char* lpstrInitialDir;
        public char* lpstrTitle;
        public uint Flags;
        public ushort nFileOffset;
        public ushort nFileExtension;
        public char* lpstrDefExt;
        public nint lCustData;
        public nint lpfnHook;
        public char* lpTemplateName;
        public nint pvReserved;
        public uint dwReserved;
        public uint FlagsEx;
    }

    // ---- user32 --------------------------------------------------------------
    [LibraryImport("user32.dll", SetLastError = true)]
    public static partial ushort RegisterClassExW(WNDCLASSEXW* windowClass);

    [LibraryImport("user32.dll", SetLastError = true, StringMarshalling = StringMarshalling.Utf16)]
    public static partial nint CreateWindowExW(uint exStyle, string className, string windowName, uint style,
        int x, int y, int width, int height, nint parent, nint menu, nint instance, nint param);

    [LibraryImport("user32.dll")]
    public static partial nint DefWindowProcW(nint hwnd, uint msg, nint wParam, nint lParam);

    [LibraryImport("user32.dll")]
    public static partial nint CallWindowProcW(nint previous, nint hwnd, uint msg, nint wParam, nint lParam);

    [LibraryImport("user32.dll", SetLastError = true)]
    public static partial nint SetWindowLongPtrW(nint hwnd, int index, nint value);

    [LibraryImport("user32.dll", SetLastError = true)]
    public static partial nint GetWindowLongPtrW(nint hwnd, int index);

    [LibraryImport("user32.dll")]
    public static partial int ShowWindow(nint hwnd, int command);

    [LibraryImport("user32.dll")]
    public static partial int UpdateWindow(nint hwnd);

    [LibraryImport("user32.dll")]
    public static partial int DestroyWindow(nint hwnd);

    [LibraryImport("user32.dll")]
    public static partial int PostMessageW(nint hwnd, uint msg, nint wParam, nint lParam);

    [LibraryImport("user32.dll")]
    public static partial nint SendMessageW(nint hwnd, uint msg, nint wParam, nint lParam);

    [LibraryImport("user32.dll")]
    public static partial void PostQuitMessage(int exitCode);

    [LibraryImport("user32.dll")]
    public static partial int GetClientRect(nint hwnd, RECT* rect);

    [LibraryImport("user32.dll")]
    public static partial int GetWindowRect(nint hwnd, RECT* rect);

    [LibraryImport("user32.dll")]
    public static partial int MoveWindow(nint hwnd, int x, int y, int width, int height, int repaint);

    [LibraryImport("user32.dll")]
    public static partial int SetWindowPos(nint hwnd, nint insertAfter, int x, int y, int cx, int cy, uint flags);

    [LibraryImport("user32.dll")]
    public static partial int GetWindowPlacement(nint hwnd, WINDOWPLACEMENT* placement);

    [LibraryImport("user32.dll")]
    public static partial int SetWindowPlacement(nint hwnd, WINDOWPLACEMENT* placement);

    [LibraryImport("user32.dll")]
    public static partial nint MonitorFromRect(RECT* rect, uint flags);

    [LibraryImport("user32.dll")]
    public static partial nint MonitorFromWindow(nint hwnd, uint flags);

    [LibraryImport("user32.dll")]
    public static partial int GetMonitorInfoW(nint monitor, MONITORINFO* info);

    [LibraryImport("user32.dll", StringMarshalling = StringMarshalling.Utf16)]
    public static partial int SetWindowTextW(nint hwnd, string text);

    [LibraryImport("user32.dll", StringMarshalling = StringMarshalling.Utf16)]
    public static partial nint FindWindowW(string? className, string? windowName);

    [LibraryImport("user32.dll")]
    public static partial int SetForegroundWindow(nint hwnd);

    [LibraryImport("user32.dll")]
    public static partial nint SetFocus(nint hwnd);

    [LibraryImport("user32.dll")]
    public static partial int IsIconic(nint hwnd);

    [LibraryImport("user32.dll")]
    public static partial int IsZoomed(nint hwnd);

    [LibraryImport("user32.dll")]
    public static partial short GetKeyState(int virtualKey);

    [LibraryImport("user32.dll")]
    public static partial uint GetDpiForWindow(nint hwnd);

    [LibraryImport("user32.dll")]
    public static partial int SetProcessDpiAwarenessContext(nint context);

    [LibraryImport("user32.dll")]
    public static partial int AdjustWindowRectExForDpi(RECT* rect, uint style, int hasMenu, uint exStyle, uint dpi);

    [LibraryImport("user32.dll", StringMarshalling = StringMarshalling.Utf16)]
    public static partial int MessageBoxW(nint owner, string text, string caption, uint type);

    [LibraryImport("user32.dll")]
    public static partial nint LoadImageW(nint instance, nint name, uint type, int cx, int cy, uint flags);

    [LibraryImport("user32.dll")]
    public static partial nint LoadCursorW(nint instance, nint cursorName);

    [LibraryImport("user32.dll")]
    public static partial int DestroyIcon(nint icon);

    [LibraryImport("user32.dll")]
    public static partial int FillRect(nint hdc, RECT* rect, nint brush);

    [LibraryImport("user32.dll")]
    public static partial int InvalidateRect(nint hwnd, RECT* rect, int erase);

    [LibraryImport("user32.dll")]
    public static partial int GetSystemMetricsForDpi(int index, uint dpi);

    [LibraryImport("user32.dll")]
    public static partial nuint SetTimer(nint hwnd, nuint id, uint elapseMilliseconds, nint timerProc);

    [LibraryImport("user32.dll")]
    public static partial int KillTimer(nint hwnd, nuint id);

    // ---- gdi32 ---------------------------------------------------------------
    [LibraryImport("gdi32.dll")]
    public static partial nint CreateSolidBrush(uint colorRef);

    [LibraryImport("gdi32.dll")]
    public static partial int DeleteObject(nint obj);

    // ---- kernel32 / ole32 ----------------------------------------------------
    [LibraryImport("kernel32.dll", StringMarshalling = StringMarshalling.Utf16)]
    public static partial nint GetModuleHandleW(string? moduleName);

    [LibraryImport("kernel32.dll", SetLastError = true, StringMarshalling = StringMarshalling.Utf16)]
    public static partial nint CreateMutexW(nint attributes, int initialOwner, string name);

    [LibraryImport("kernel32.dll")]
    public static partial int CloseHandle(nint handle);

    [LibraryImport("kernel32.dll", SetLastError = true, StringMarshalling = StringMarshalling.Utf16)]
    public static partial int SetDllDirectoryW(string path);

    [LibraryImport("ole32.dll")]
    public static partial int OleInitialize(nint reserved);

    [LibraryImport("ole32.dll")]
    public static partial void OleUninitialize();

    // ---- shell32 / dwmapi / comdlg32 ----------------------------------------
    [LibraryImport("shell32.dll", StringMarshalling = StringMarshalling.Utf16)]
    public static partial nint ShellExecuteW(nint hwnd, string? operation, string file, string? parameters, string? directory, int showCommand);

    [LibraryImport("shell32.dll")]
    public static partial int Shell_NotifyIconW(uint message, NOTIFYICONDATAW* data);

    [LibraryImport("shell32.dll")]
    public static partial int SHGetKnownFolderPath(Guid* folderId, uint flags, nint token, char** path);

    [LibraryImport("shell32.dll", StringMarshalling = StringMarshalling.Utf16)]
    public static partial int SetCurrentProcessExplicitAppUserModelID(string appId);

    [LibraryImport("dwmapi.dll")]
    public static partial int DwmSetWindowAttribute(nint hwnd, int attribute, void* value, int size);

    [LibraryImport("comdlg32.dll")]
    public static partial int GetOpenFileNameW(OPENFILENAMEW* ofn);

    [LibraryImport("comdlg32.dll")]
    public static partial uint CommDlgExtendedError();

    // ---- Helpers -------------------------------------------------------------
    public static int LoWord(nint value) => (int)((long)value & 0xFFFF);
    public static int HiWord(nint value) => (int)(((long)value >> 16) & 0xFFFF);
    public static nint MakeLParam(int low, int high) => (nint)((high << 16) | (low & 0xFFFF));
    public static bool IsKeyDown(int virtualKey) => GetKeyState(virtualKey) < 0;
    public static uint Rgb(byte r, byte g, byte b) => (uint)(r | (g << 8) | (b << 16));
}
