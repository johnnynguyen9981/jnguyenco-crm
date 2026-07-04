@echo off
REM Open Settings to Email & accounts, then click Add account and choose Google
powershell -ExecutionPolicy Bypass -Command ^
"Add-Type -AssemblyName UIAutomationClient; ^
Add-Type -AssemblyName UIAutomationTypes; ^
Start-Sleep -Seconds 1; ^
$root = [System.Windows.Automation.AutomationElement]::RootElement; ^
$cond1 = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, 'Add an account'); ^
$btn = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond1); ^
if ($btn) { ^
    $invoke = $btn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern); ^
    $invoke.Invoke(); ^
    Write-Host 'Clicked: Add an account'; ^
    Start-Sleep -Seconds 2; ^
    $cond2 = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, 'Google'); ^
    $gBtn = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond2); ^
    if ($gBtn) { $inv2 = $gBtn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern); $inv2.Invoke(); Write-Host 'Clicked: Google'; } ^
    else { Write-Host 'Google button not found - check the dialog that opened'; } ^
} else { Write-Host 'Add an account button not found - make sure Settings is on Email and accounts page'; }"
pause
