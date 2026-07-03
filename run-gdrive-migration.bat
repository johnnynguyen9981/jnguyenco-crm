@echo off
echo ============================================================
echo  Supabase Migration: add gdrive_folder_id to clients table
echo ============================================================
echo.
echo Copying SQL to clipboard...
echo ALTER TABLE clients ADD COLUMN IF NOT EXISTS gdrive_folder_id text; | clip
echo.
echo Opening Supabase SQL Editor in Chrome...
start chrome "https://supabase.com/dashboard/project/outgfozwoktqtendezaq/sql/new"
echo.
echo ============================================================
echo  INSTRUCTIONS:
echo  1. Wait for the Supabase SQL Editor to load in Chrome
echo  2. Click inside the SQL editor
echo  3. Press Ctrl+A  (select all)
echo  4. Press Delete  (clear existing text)
echo  5. Press Ctrl+V  (paste the migration SQL)
echo  6. Press Ctrl+Enter  OR click the "Run" button
echo ============================================================
echo.
echo The SQL on your clipboard is:
echo ALTER TABLE clients ADD COLUMN IF NOT EXISTS gdrive_folder_id text;
echo.
pause
