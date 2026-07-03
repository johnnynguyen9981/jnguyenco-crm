-- Add gdrive_folder_id to clients table
-- This stores the Google Drive folder ID for each client's CRM folder.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS gdrive_folder_id text;
