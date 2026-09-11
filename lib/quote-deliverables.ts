// Plain data, deliberately kept out of lib/generate-quote.tsx (which imports
// @react-pdf/renderer + JSX) so App Router routes can use this list without
// pulling react-pdf into the app-router module graph — see
// lib/pdf/render-client.ts for why that matters.
export const PACKAGE_DELIVERABLES: Record<string, string[]> = {
  "Mini Wedding / Elopement": [
    "1 Photographer & 1 Videographer (up to 4 hours)",
    "200–350 professionally edited images",
    "3–5 minute cinematic highlight film",
    "Next-day teaser reel (24–48 hr delivery)",
    "Online gallery via Google Drive",
  ],
  "Full Day Essential": [
    "1 Photographer & 1 Videographer (up to 8 hours)",
    "400–600 professionally edited images",
    "5–7 minute cinematic highlight film",
    "Next-day teaser reel (24–48 hr delivery)",
    "Full ceremony coverage",
    "Online gallery via Google Drive",
  ],
  "Full Day Premium": [
    "2 Photographers & 2 Videographers (up to 13 hours)",
    "700–1,000 professionally edited images",
    "6–8 minute cinematic film",
    "Next-day teaser reel (24–48 hr delivery)",
    "Full ceremony coverage",
    "Full speeches coverage",
    "Online gallery via Google Drive",
  ],
  "Hourly Photography": [
    "1 Photographer",
    "80–150 professionally edited images per hour",
    "Online gallery via Google Drive (delivered within 1–2 weeks)",
  ],
  "Hourly Photo + Video": [
    "1 Photographer & 1 Videographer",
    "80–150 professionally edited images per hour",
    "Short event highlight (1–3 min)",
    "Online gallery via Google Drive (delivered within 2–3 weeks)",
  ],
};

export const DEFAULT_DELIVERABLES = [
  "Professional photography and/or videography as agreed",
  "Fully edited images and/or film delivered via Google Drive",
  "Online gallery access",
];
