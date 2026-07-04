Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$out = @()

# List all top-level windows first
$wins = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
$out += "=== TOP LEVEL WINDOWS ==="
foreach ($w in $wins) {
    try { $out += ("WINDOW: " + $w.Current.Name + " | CLASS: " + $w.Current.ClassName) } catch {}
}

# Find Settings window specifically
$settingsCond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ClassNameProperty, "ApplicationFrameWindow")
$settingsWin = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $settingsCond)

if ($settingsWin) {
    $out += ""
    $out += "=== SETTINGS WINDOW FOUND: " + $settingsWin.Current.Name + " ==="
    $trueCond = [System.Windows.Automation.Condition]::TrueCondition
    $all = $settingsWin.FindAll([System.Windows.Automation.TreeScope]::Descendants, $trueCond)
    $out += "Total child elements: " + $all.Count
    $out += ""
    $out += "=== ALL NAMED ELEMENTS ==="
    foreach ($e in $all) {
        try {
            $n = $e.Current.Name
            $ct = $e.Current.ControlType.ProgrammaticName
            if ($n -and $n.Trim().Length -gt 1) {
                $out += ($ct + " | " + $n)
            }
        } catch {}
    }
} else {
    $out += "Settings window (ApplicationFrameWindow) not found!"
}

$out | Out-File -FilePath "J:\CRM\jnguyenco-crm\buttons-output.txt" -Encoding UTF8
Write-Host "Done! Output written to buttons-output.txt"
