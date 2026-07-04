Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$out = @()

# Find ALL ApplicationFrameWindow instances (Settings, Media Player, etc.)
$afwCond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ClassNameProperty, "ApplicationFrameWindow")
$afwWins = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $afwCond)

$out += "=== ApplicationFrameWindow instances found: " + $afwWins.Count + " ==="
foreach ($w in $afwWins) {
    try { $out += "  - " + $w.Current.Name } catch {}
}

# Pick the one named "Settings"
$settingsWin = $null
foreach ($w in $afwWins) {
    try {
        if ($w.Current.Name -eq "Settings") {
            $settingsWin = $w
            break
        }
    } catch {}
}

if ($settingsWin) {
    $out += ""
    $out += "=== SETTINGS WINDOW FOUND ==="
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
    $out += ""
    $out += "Settings window not found among ApplicationFrameWindow instances!"
    $out += "Make sure the Settings app is open and on the Email & accounts page."
}

$out | Out-File -FilePath "J:\CRM\jnguyenco-crm\settings-elements.txt" -Encoding UTF8
Write-Host "Done! Output written to settings-elements.txt"
