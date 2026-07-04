@echo off
:: JNguyen Co. — Google Workspace PC Setup Script
:: Run this as your normal user (no admin needed)
echo.
echo =====================================================
echo  JNguyen Co. Google Workspace Setup
echo =====================================================
echo.

:: --- 1. Create Desktop shortcuts for Google Workspace apps ---
echo Creating Google Workspace shortcuts on Desktop...

:: Gmail app shortcut
powershell -Command "$s = (New-Object -COM WScript.Shell).CreateShortcut('%USERPROFILE%\Desktop\Gmail.lnk'); $s.TargetPath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'; $s.Arguments = '--app=https://mail.google.com/mail/u/0/ --profile-directory=Default'; $s.Description = 'Gmail - JNguyen Co.'; $s.Save()"

:: Google Calendar app shortcut
powershell -Command "$s = (New-Object -COM WScript.Shell).CreateShortcut('%USERPROFILE%\Desktop\Google Calendar.lnk'); $s.TargetPath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'; $s.Arguments = '--app=https://calendar.google.com/calendar/u/0/r --profile-directory=Default'; $s.Description = 'Google Calendar - JNguyen Co.'; $s.Save()"

:: Google Meet app shortcut
powershell -Command "$s = (New-Object -COM WScript.Shell).CreateShortcut('%USERPROFILE%\Desktop\Google Meet.lnk'); $s.TargetPath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'; $s.Arguments = '--app=https://meet.google.com --profile-directory=Default'; $s.Description = 'Google Meet - JNguyen Co.'; $s.Save()"

:: Google Drive shortcut (opens G: drive in Explorer)
powershell -Command "$s = (New-Object -COM WScript.Shell).CreateShortcut('%USERPROFILE%\Desktop\Google Drive.lnk'); $s.TargetPath = 'G:\'; $s.Description = 'Google Drive'; $s.Save()"

echo.
echo Desktop shortcuts created: Gmail, Calendar, Meet, Drive
echo.

:: --- 2. Open Windows Settings > Accounts > Email & accounts ---
echo Opening Windows Settings for Google Calendar sync...
echo (Add your Google account to sync Calendar with Windows apps)
echo.
start ms-settings:emailandaccounts

:: Small delay
timeout /t 2 /nobreak > nul

:: --- 3. Open Google Admin Console ---
echo Opening Google Admin Console...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "https://admin.google.com" --profile-directory=Default

timeout /t 1 /nobreak > nul

:: --- 4. Pin Gmail and Calendar to taskbar tip ---
echo.
echo =====================================================
echo  SETUP COMPLETE
echo =====================================================
echo.
echo Desktop shortcuts created for:
echo   - Gmail (app window, no browser chrome)
echo   - Google Calendar (app window)
echo   - Google Meet (app window)
echo   - Google Drive (G: drive)
echo.
echo Next steps (manual - 2 minutes):
echo   1. In the Settings window that opened:
echo      Click "Add account" > Google > sign in with
echo      johnny.nguyen@jnguyen.co to sync Calendar
echo.
echo   2. In the Admin Console that opened:
echo      Enter your password to access Google Workspace
echo      admin settings
echo.
echo   3. Optional - Install as true PWA:
echo      Open Chrome > go to mail.google.com
echo      Click the computer+plus icon in address bar
echo      Click "Install" to get Gmail in Start Menu
echo.
pause
