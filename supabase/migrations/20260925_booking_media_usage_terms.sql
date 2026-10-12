-- Per-booking privacy / media-use terms. When set, the contract replaces the
-- standard portfolio/marketing licence (Section 6.4) with a restricted clause:
-- Photographer may only use the Images described here, and only after the
-- Client approves each one in writing. One permitted use per line.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS media_usage_terms text;
