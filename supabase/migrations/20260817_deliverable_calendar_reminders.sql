-- Deliverable calendar reminders
-- Links a deliverable to a Google Calendar event so due dates (photo gallery,
-- highlight film, teaser, raw footage) can show up as reminders on the same
-- Google Calendar the booking's shoot day is synced to.
alter table deliverables
  add column if not exists gcal_event_id text;

comment on column deliverables.gcal_event_id is
  'Google Calendar event ID for this deliverable''s due-date reminder (nullable — set once synced via /api/google/calendar/sync-deliverable).';
