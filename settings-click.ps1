Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public class Win32Helper {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumChildWindows(IntPtr hwndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    public static List<IntPtr> GetChildWindows(IntPtr parent) {
        var result = new List<IntPtr>();
        EnumChildWindows(parent, (hWnd, lParam) => { result.Add(hWnd); return true; }, IntPtr.Zero);
        return result;
    }
}
"@
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$out = @()

# Open Settings to email & accounts
Start-Process "ms-settings:emailandaccounts"
Start-Sleep -Seconds 2

# Find the Settings window
$settingsHwnd = [Win32Helper]::FindWindow("ApplicationFrameWindow", "Settings")
$out += "Settings HWND: $settingsHwnd"

if ($settingsHwnd -ne [IntPtr]::Zero) {
    # Bring to foreground
    [Win32Helper]::ShowWindow($settingsHwnd, 9)   # SW_RESTORE
    [Win32Helper]::SetForegroundWindow($settingsHwnd)
    Start-Sleep -Milliseconds 1000

    # Get window rect
    $rect = New-Object Win32Helper+RECT
    [Win32Helper]::GetWindowRect($settingsHwnd, [ref]$rect) | Out-Null
    $out += "Settings window: Left=$($rect.Left) Top=$($rect.Top) Right=$($rect.Right) Bottom=$($rect.Bottom)"
    $out += "Width=$($rect.Right - $rect.Left) Height=$($rect.Bottom - $rect.Top)"

    # Enumerate all child windows
    $children = [Win32Helper]::GetChildWindows($settingsHwnd)
    $out += "Child window count: $($children.Count)"

    foreach ($child in $children) {
        $className = New-Object System.Text.StringBuilder 256
        [Win32Helper]::GetClassName($child, $className, 256) | Out-Null
        $title = New-Object System.Text.StringBuilder 256
        [Win32Helper]::GetWindowText($child, $title, 256) | Out-Null

        $childRect = New-Object Win32Helper+RECT
        [Win32Helper]::GetWindowRect($child, [ref]$childRect) | Out-Null

        $out += "  HWND=$child Class='$($className)' Title='$($title)' Rect=[$($childRect.Left),$($childRect.Top),$($childRect.Right),$($childRect.Bottom)]"

        # Try UIAutomation on this child handle
        try {
            $elem = [System.Windows.Automation.AutomationElement]::FromHandle($child)
            $trueCond = [System.Windows.Automation.Condition]::TrueCondition
            $sub = $elem.FindAll([System.Windows.Automation.TreeScope]::Descendants, $trueCond)
            $out += "    UIA children: $($sub.Count)"
            foreach ($e in $sub) {
                try {
                    $n = $e.Current.Name
                    $ct = $e.Current.ControlType.ProgrammaticName
                    if ($n -and $n.Trim().Length -gt 1) {
                        $out += "      $ct | $n"
                    }
                } catch {}
            }
        } catch {
            $out += "    UIA error: $($_.Exception.Message)"
        }
    }
} else {
    $out += "Settings window not found!"
}

$out | Out-File -FilePath "J:\CRM\jnguyenco-crm\settings-hwnd.txt" -Encoding UTF8
Write-Host "Done! Written to settings-hwnd.txt"
