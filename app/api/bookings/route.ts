// GET  /api/bookings  — list bookings (filterable by status, date range, service_type)
// POST /api/bookings  — create new booking
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/utils";
import type { BookingInsert } from "@/lib/supabase/types";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const sp           = new URL(req.url).searchParams;
  const status       = sp.get("status");
  const serviceType  = sp.get("service_type");
  const from         = sp.get("from");   // YYYY-MM-DD
  const to           = sp.get("to");
  const clientId     = sp.get("client_id");
  const page         = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const limit        = Math.min(50, parseInt(sp.get("limit") ?? "25"));
  const offset       = (page - 1) * limit;

  let query = supabase
    .from("bookings")
    .select(`
      *,
      clients (id, first_name, last_name, email, phone),
      packages (id, name, base_price, includes_photography, includes_videography)
    `, { count: "exact" })
    .eq("owner_id", user.id)
    .order("event_date", { ascending: true })
    .range(offset, offset + limit - 1);

  if (status)      query = query.eq("status", status);
  if (serviceType) query = query.eq("service_type", serviceType);
  if (from)        query = query.gte("event_date", from);
  if (to)          query = query.lte("event_date", to);
  if (clientId)    query = query.eq("client_id", clientId);

  const { data, error, count } = await query;
  if (error) return apiError(error.message, 500);

  return apiSuccess({
    bookings: data,
    pagination: { total: count ?? 0, page, limit, pages: Math.ceil((count ?? 0) / limit) },
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  let body: BookingInsert;
  try { body = await req.json(); } catch { return apiError("Invalid JSON"); }

  if (!body.client_id)    return apiError("client_id is required");
  if (!body.service_type) return apiError("service_type is required");
  if (!body.event_date)   return apiError("event_date is required");

  // Confirm client belongs to this owner
  const { data: client } = await supabase
    .from("clients").select("id").eq("id", body.client_id).eq("owner_id", user.id).maybeSingle();
  if (!client) return apiError("Client not found", 404);

  // Check for double-booking on same date (warn but don't block — user may have crew)
  const { count: sameDay } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("event_date", body.event_date)
    .in("status", ["CONTRACTED", "CONFIRMED"]);

  const { data, error } = await supabase
    .from("bookings")
    .insert({ ...body, owner_id: user.id })
    .select(`*, clients(first_name, last_name, email), packages(name, base_price)`)
    .single();

  if (error) return apiError(error.message, 500);

  return apiSuccess({ booking: data, double_booking_warning: (sameDay ?? 0) > 0 }, 201);
}
