@echo off
powershell -ExecutionPolicy Bypass -Command ^
"Add-Type -AssemblyName UIAutomationClient; ^
Add-Type -AssemblyName UIAutomationTypes; ^
$root = [System.Windows.Automation.AutomationElement]::RootElement; ^
$settingsCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, 'ApplicationFrameWindow'); ^
$settingsWin = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $settingsCond); ^
if ($settingsWin) { Write-Host 'Found Settings window:' $settingsWin.Current.Name; $all = $settingsWin.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition); Write-Host 'Total elements:' $all.Count; foreach ($e in $all) { try { $n = $e.Current.Name; $ct = $e.Current.ControlType.ProgrammaticName; if ($n -and $n.Length -gt 1) { Write-Host $ct '|' $n } } catch {} } } else { Write-Host 'Settings window not found. All top-level windows:'; $wins = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition); foreach ($w in $wins) { try { Write-Host $w.Current.Name $w.Current.ClassName } catch {} } }" ^
> J:\CRM\jnguyenco-crm\buttons-output.txt 2>&1
echo Done. Output saved to buttons-output.txt
pause
