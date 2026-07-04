Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Win32Click {
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, IntPtr dwExtraInfo);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP   = 0x0004;

    public static void ClickAt(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(100);
        mouse_event(MOUSEEVENTF_LEFTDOWN, x, y, 0, IntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTUP,   x, y, 0, IntPtr.Zero);
    }
}
"@

# Make sure Settings is open at emailandaccounts page
Write-Host "Opening Settings > Email and accounts..."
Start-Process "ms-settings:emailandaccounts"
Start-Sleep -Seconds 3

# Find Settings window
$hWnd = [Win32Click]::FindWindow("ApplicationFrameWindow", "Settings")
if ($hWnd -eq [IntPtr]::Zero) {
    Write-Host "ERROR: Settings window not found!"
    exit 1
}
Write-Host "Settings HWND: $hWnd"

# Move to primary monitor at known position (top-left area) and give it room
[Win32Click]::ShowWindow($hWnd, 9)  # SW_RESTORE
Start-Sleep -Milliseconds 300
[Win32Click]::MoveWindow($hWnd, 50, 50, 1100, 850, $true)
Start-Sleep -Milliseconds 500
[Win32Click]::SetForegroundWindow($hWnd)
Start-Sleep -Milliseconds 500

# Verify position
$rect = New-Object Win32Click+RECT
[Win32Click]::GetWindowRect($hWnd, [ref]$rect) | Out-Null
Write-Host "Settings window moved to: L=$($rect.Left) T=$($rect.Top) R=$($rect.Right) B=$($rect.Bottom)"

# Layout in Settings > Email & accounts (window at 50,50, width 1100):
# - Title bar: ~32px
# - Left nav sidebar: ~315px (from left edge of window = 50+315 = 365)
# - Content area starts at X = 50 + 315 = 365
# - "Add an account" button is usually around Y = 50 + 350 = 400 (varies by number of existing accounts)
# Let's click at several Y positions to find it

$winLeft = $rect.Left
$winTop  = $rect.Top
$contentX = $winLeft + 450   # Past the sidebar (315px) and some margin

Write-Host ""
Write-Host "Clicking in content area at X=$contentX ..."
Write-Host "First attempting Y positions: 380, 440, 500..."

# Try clicking "Add an account" - scroll the area first to show it
# Typical positions on Email & accounts page (no existing Google accounts):
# Y offset from window top ~300-400px
foreach ($yOffset in @(300, 360, 420, 480)) {
    $clickY = $winTop + $yOffset
    Write-Host "Clicking at ($contentX, $clickY) - offset from top: $yOffset"
    [Win32Click]::SetForegroundWindow($hWnd) | Out-Null
    Start-Sleep -Milliseconds 300
    [Win32Click]::ClickAt($contentX, $clickY)
    Start-Sleep -Milliseconds 400
}

Write-Host ""
Write-Host "Done. Check if 'Add an account' dialog appeared."
Write-Host "If a dialog opened asking which account type, look for and click 'Google'."
