Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using System.Diagnostics;
public class Win32Finder {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    public static List<IntPtr> GetAllWindows() {
        var result = new List<IntPtr>();
        EnumWindows((hWnd, lParam) => { result.Add(hWnd); return true; }, IntPtr.Zero);
        return result;
    }
}
"@

$out = @()

# Find all windows belonging to systemsettings.exe
$allWindows = [Win32Finder]::GetAllWindows()
$out += "Total windows enumerated: $($allWindows.Count)"

# Get systemsettings.exe processes
$settingsProcs = Get-Process -Name "SystemSettings" -ErrorAction SilentlyContinue
if ($settingsProcs) {
    $out += "SystemSettings processes: $($settingsProcs.Count)"
    foreach ($p in $settingsProcs) { $out += "  PID: $($p.Id)" }
    $settingsPids = $settingsProcs | ForEach-Object { [uint32]$_.Id }
} else {
    $out += "SystemSettings process NOT found! Opening Settings..."
    Start-Process "ms-settings:emailandaccounts"
    Start-Sleep -Seconds 2
    $settingsProcs = Get-Process -Name "SystemSettings" -ErrorAction SilentlyContinue
    $settingsPids = $settingsProcs | ForEach-Object { [uint32]$_.Id }
}

# Find all windows owned by systemsettings.exe
$out += ""
$out += "=== Windows owned by SystemSettings.exe ==="
foreach ($hWnd in $allWindows) {
    $pid = [uint32]0
    [Win32Finder]::GetWindowThreadProcessId($hWnd, [ref]$pid) | Out-Null

    if ($settingsPids -contains $pid) {
        $className = New-Object System.Text.StringBuilder 256
        [Win32Finder]::GetClassName($hWnd, $className, 256) | Out-Null
        $title = New-Object System.Text.StringBuilder 256
        [Win32Finder]::GetWindowText($hWnd, $title, 256) | Out-Null
        $rect = New-Object Win32Finder+RECT
        [Win32Finder]::GetWindowRect($hWnd, [ref]$rect) | Out-Null
        $visible = [Win32Finder]::IsWindowVisible($hWnd)

        $out += "  HWND=$hWnd Class='$($className)' Title='$($title)' Visible=$visible"
        $out += "    Rect: L=$($rect.Left) T=$($rect.Top) R=$($rect.Right) B=$($rect.Bottom) W=$($rect.Right-$rect.Left) H=$($rect.Bottom-$rect.Top)"
    }
}

# Also look for the ApplicationFrameWindow named "Settings" and its rect
$out += ""
$out += "=== ApplicationFrameWindow named Settings ==="
foreach ($hWnd in $allWindows) {
    $className = New-Object System.Text.StringBuilder 256
    [Win32Finder]::GetClassName($hWnd, $className, 256) | Out-Null
    $title = New-Object System.Text.StringBuilder 256
    [Win32Finder]::GetWindowText($hWnd, $title, 256) | Out-Null
    if ($className.ToString() -eq "ApplicationFrameWindow" -and $title.ToString() -eq "Settings") {
        $rect = New-Object Win32Finder+RECT
        [Win32Finder]::GetWindowRect($hWnd, [ref]$rect) | Out-Null
        $out += "  HWND=$hWnd"
        $out += "  Rect: L=$($rect.Left) T=$($rect.Top) R=$($rect.Right) B=$($rect.Bottom) W=$($rect.Right-$rect.Left) H=$($rect.Bottom-$rect.Top)"

        # Restore and bring to front
        [Win32Finder]::ShowWindow($hWnd, 9) | Out-Null
        [Win32Finder]::SetForegroundWindow($hWnd) | Out-Null
        Start-Sleep -Milliseconds 500
        [Win32Finder]::GetWindowRect($hWnd, [ref]$rect) | Out-Null
        $out += "  After restore - Rect: L=$($rect.Left) T=$($rect.Top) R=$($rect.Right) B=$($rect.Bottom) W=$($rect.Right-$rect.Left) H=$($rect.Bottom-$rect.Top)"
    }
}

$out | Out-File -FilePath "J:\CRM\jnguyenco-crm\settings-pos.txt" -Encoding UTF8
Write-Host "Done! Written to settings-pos.txt"
