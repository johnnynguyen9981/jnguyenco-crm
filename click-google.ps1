Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Clicker {
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, IntPtr dwExtraInfo);
    public const uint LEFTDOWN = 0x0002;
    public const uint LEFTUP   = 0x0004;
    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(80);
        mouse_event(LEFTDOWN, x, y, 0, IntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        mouse_event(LEFTUP,   x, y, 0, IntPtr.Zero);
    }
}
"@

Write-Host "Clicking 'Google' option in Add an account dialog..."
Write-Host "Trying Y positions around center of Settings window..."

# Settings window is at (50,50,1150,900), center X ~ 600
# Add an account dialog is centered horizontally around X=600
# Dialog appears at roughly Y=150 from Settings top
# Options listed: 1=Microsoft Exchange, 2=Google, 3=Yahoo, 4=iCloud, 5=Other
# Each option is ~50-60px tall, first at Y~230, so Google at Y~290

foreach ($y in @(270, 300, 330, 360)) {
    Write-Host "Clicking at (600, $y)..."
    [Clicker]::Click(600, $y)
    Start-Sleep -Milliseconds 600
}
Write-Host "Done. If Google was clicked, sign-in should appear in Chrome."
