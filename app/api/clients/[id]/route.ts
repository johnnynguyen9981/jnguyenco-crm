// GET    /api/clients/[id]  — fetch one client with bookings + invoices
// PATCH  /api/clients/[id]  — update client fields
// DELETE /api/clients/[id]  — delete client (fails if they have bookings)
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/utils";
import type { ClientUpdate } from "@/lib/supabase/types";

type Params = { params: { id: string } };

// ── GET /api/clients/[id] ─────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const { data, error } = await supabase
    .from("clients")
    .select(`
      *,
      bookings (
        id, event_date, status, service_type, quoted_total, gcal_event_id,
        packages (name, base_price)
      ),
      invoices (
        id, invoice_number, status, total_amount, amount_paid, due_date, issue_date
      )
    `)
    .eq("id", params.id)
    .eq("owner_id", user.id)  // RLS double-check
    .single();

  if (error) {
    return error.code === "PGRST116"
      ? apiError("Client not found", 404)
      : apiError(error.message, 500);
  }

  return apiSuccess(data);
}

// ── PATCH /api/clients/[id] ───────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  let body: ClientUpdate;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }

  // Validate email if provided
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return apiError("Invalid email address");
  }

  // Strip owner_id — never let caller override it
  const { owner_id: _, ...safeBody } = body as any;

  const { data, error } = await supabase
    .from("clients")
    .update({ ...safeBody, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .select()
    .single();

  if (error) {
    return error.code === "PGRST116"
      ? apiError("Client not found", 404)
      : apiError(error.message, 500);
  }

  return apiSuccess(data);
}

// ── DELETE /api/clients/[id] ──────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  // Block deletion if client has bookings
  const { count: bookingCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("client_id", params.id);

  if ((bookingCount ?? 0) > 0) {
    return apiError(
      `Cannot delete client — they have ${bookingCount} booking(s) on record. Cancel or reassign them first.`,
      409
    );
  }

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", params.id)
    .eq("owner_id", user.id);

  if (error) return apiError(error.message, 500);
  return new Response(null, { status: 204 });
}
