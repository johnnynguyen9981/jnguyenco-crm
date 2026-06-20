$WshShell = New-Object -comObject WScript.Shell

# Desktop shortcut
$desktop = [System.Environment]::GetFolderPath("Desktop")
$shortcut = $WshShell.CreateShortcut("$desktop\JNguyen Co CRM.lnk")
$shortcut.TargetPath = "cmd.exe"
$shortcut.Arguments = "/c `"$PSScriptRoot\StartCRM.bat`""
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.WindowStyle = 1
$shortcut.Description = "Start JNguyen Co. CRM"
# Use Node.js icon
$shortcut.IconLocation = "C:\Program Files\nodejs\node.exe,0"
$shortcut.Save()

Write-Host "Shortcut created on Desktop!"
