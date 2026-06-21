// GET  /api/clients       — list all clients (with search + pagination)
// POST /api/clients       — create a new client
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/utils";
import type { ClientInsert } from "@/lib/supabase/types";
import { getOrCreateClientFolder, isDriveConfigured } from "@/lib/google/drive";

// ── GET /api/clients ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const search  = searchParams.get("search")?.trim() ?? "";
  const page    = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit   = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));
  const offset  = (page - 1) * limit;

  let query = supabase
    .from("clients")
    .select("*, bookings(id, event_date, status, service_type)", { count: "exact" })
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    // Search across name, email, phone, instagram
    query = query.or(
      `first_name.ilike.%${search}%,` +
      `last_name.ilike.%${search}%,` +
      `email.ilike.%${search}%,` +
      `phone.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query;
  if (error) return apiError(error.message, 500);

  return apiSuccess({
    clients: data,
    pagination: {
      total: count ?? 0,
      page,
      limit,
      pages: Math.ceil((count ?? 0) / limit),
    },
  });
}

// ── POST /api/clients ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  let body: ClientInsert;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }

  // Validate required fields
  if (!body.first_name?.trim()) return apiError("first_name is required");
  if (!body.last_name?.trim())  return apiError("last_name is required");
  if (!body.email?.trim())      return apiError("email is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return apiError("Invalid email address");
  }

  // Check for duplicate email under this owner
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("owner_id", user.id)
    .eq("email", body.email.toLowerCase().trim())
    .maybeSingle();

  if (existing) return apiError("A client with this email already exists", 409);

  const { data, error } = await supabase
    .from("clients")
    .insert({
      ...body,
      email:    body.email.toLowerCase().trim(),
      owner_id: user.id,
    })
    .select()
    .single();
  if (error) return apiError(error.message, 500);

  // Create Google Drive folder (non-fatal)
  if (isDriveConfigured() && data) {
    const clientName = `${data.first_name} ${data.last_name}`.trim();
    getOrCreateClientFolder(data.id, clientName).catch((e) =>
      console.warn("[drive] Could not create client folder:", e?.message)
    );
  }

  return apiSuccess(data, 201);
}
