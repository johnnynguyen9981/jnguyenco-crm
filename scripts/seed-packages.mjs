// scripts/seed-packages.mjs
// Run once: node scripts/seed-packages.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from .env.local
const env = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
const get = (key) => env.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim();

const supabase = createClient(
  get("NEXT_PUBLIC_SUPABASE_URL"),
  get("SUPABASE_SERVICE_ROLE_KEY")
);

const packages = [
  // ── Wedding ────────────────────────────────────────────────────────────────
  {
    name: "Mini Wedding / Elopement",
    service_type: "WEDDING",
    base_price: 1600,
    max_hours: 4,
    includes_photography: true,
    includes_videography: true,
    photo_count_min: 200,
    photo_count_max: 350,
    film_duration_min: 3,
    film_duration_max: 5,
    description:
      "An intimate and elegant coverage designed for small celebrations and meaningful moments. " +
      "1 Photographer & 1 Videographer · 200–350 edited images · 3–5 min cinematic highlight film · Next-day teaser.",
    is_active: true,
  },
  {
    name: "Full Day Essential",
    service_type: "WEDDING",
    base_price: 3200,
    max_hours: 8,
    includes_photography: true,
    includes_videography: true,
    photo_count_min: 400,
    photo_count_max: 600,
    film_duration_min: 5,
    film_duration_max: 7,
    description:
      "A complete storytelling experience capturing your day with a refined cinematic approach. " +
      "1 Photographer & 1 Videographer · 400–600 edited images · 5–7 min highlight film · Full ceremony coverage.",
    is_active: true,
  },
  {
    name: "Full Day Premium",
    service_type: "WEDDING",
    base_price: 4800,
    max_hours: 13,
    includes_photography: true,
    includes_videography: true,
    photo_count_min: 700,
    photo_count_max: 1000,
    film_duration_min: 6,
    film_duration_max: 8,
    description:
      "Expanded coverage with multiple perspectives for a richer, more dynamic story. " +
      "2 Photographers & 2 Videographers · 700–1,000 edited images · 6–8 min cinematic film · Full ceremony & speeches.",
    is_active: true,
  },
  // ── Portrait ───────────────────────────────────────────────────────────────
  {
    name: "Headshot Session",
    service_type: "PORTRAIT",
    base_price: 300,
    max_hours: 1,
    includes_photography: true,
    includes_videography: false,
    photo_count_min: 20,
    photo_count_max: 40,
    description:
      "Professional headshot session — ideal for LinkedIn, business profiles, and personal branding. " +
      "1 hr · 20–40 edited images · Online gallery delivery.",
    is_active: true,
  },
  {
    name: "Couples Portrait",
    service_type: "PORTRAIT",
    base_price: 450,
    max_hours: 2,
    includes_photography: true,
    includes_videography: false,
    photo_count_min: 50,
    photo_count_max: 80,
    description:
      "Romantic couples session capturing connection and personality. " +
      "Up to 2 hrs · 50–80 edited images · Online gallery delivery.",
    is_active: true,
  },
  {
    name: "Family Portrait",
    service_type: "PORTRAIT",
    base_price: 550,
    max_hours: 2,
    includes_photography: true,
    includes_videography: false,
    photo_count_min: 60,
    photo_count_max: 100,
    description:
      "Relaxed family session perfect for milestone moments. " +
      "Up to 2 hrs · 60–100 edited images · Online gallery delivery.",
    is_active: true,
  },
];

// Check which packages already exist (by name)
const { data: existing } = await supabase
  .from("packages")
  .select("name");

const existingNames = new Set((existing ?? []).map((p) => p.name));
const toInsert = packages.filter((p) => !existingNames.has(p.name));

if (toInsert.length === 0) {
  console.log("✅ All packages already exist — nothing to insert.");
  process.exit(0);
}

const { data, error } = await supabase
  .from("packages")
  .insert(toInsert)
  .select("name, service_type, base_price");

if (error) {
  console.error("❌ Insert failed:", error.message);
  process.exit(1);
}

console.log(`✅ Inserted ${data.length} package(s):`);
for (const p of data) {
  console.log(`   ${p.service_type.padEnd(10)} ${p.name.padEnd(30)} $${p.base_price}`);
}
