-- Seed JNguyen Co. packages
-- Run once; uses ON CONFLICT DO NOTHING so it's safe to re-run.

INSERT INTO packages (
  name, service_type, base_price, max_hours,
  includes_photography, includes_videography,
  photo_count_min, photo_count_max,
  film_duration_min, film_duration_max,
  description, is_active
) VALUES

-- ── Wedding ─────────────────────────────────────────────────────────────────
(
  'Mini Wedding / Elopement', 'WEDDING', 1600, 4,
  true, true, 200, 350, 3, 5,
  'An intimate and elegant coverage designed for small celebrations and meaningful moments. Includes 1 Photographer & 1 Videographer, 200–350 edited images, 3–5 min cinematic highlight film, and next-day teaser.',
  true
),
(
  'Full Day Essential', 'WEDDING', 3200, 8,
  true, true, 400, 600, 5, 7,
  'A complete storytelling experience capturing your day with a refined cinematic approach. Includes 1 Photographer & 1 Videographer, 400–600 edited images, 5–7 min highlight film, and full ceremony coverage.',
  true
),
(
  'Full Day Premium', 'WEDDING', 4800, 13,
  true, true, 700, 1000, 6, 8,
  'Expanded coverage with multiple perspectives for a richer, more dynamic story. Includes 2 Photographers & 2 Videographers, 700–1,000 edited images, 6–8 min cinematic film, full ceremony & speeches.',
  true
),

-- ── Portrait ────────────────────────────────────────────────────────────────
(
  'Headshot Session', 'PORTRAIT', 300, 1,
  true, false, 20, 40, null, null,
  'Professional headshot session — ideal for LinkedIn, business profiles, and personal branding. Includes 1 hour on location or studio, 20–40 edited images delivered via online gallery.',
  true
),
(
  'Couples Portrait', 'PORTRAIT', 450, 2,
  true, false, 50, 80, null, null,
  'Romantic couples session capturing connection and personality. Includes up to 2 hours, 50–80 edited images, and online gallery delivery.',
  true
),
(
  'Family Portrait', 'PORTRAIT', 550, 2,
  true, false, 60, 100, null, null,
  'Relaxed family session perfect for milestone moments. Includes up to 2 hours, 60–100 edited images, and online gallery delivery.',
  true
)

ON CONFLICT DO NOTHING;
