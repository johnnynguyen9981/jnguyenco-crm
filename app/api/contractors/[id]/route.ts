// GET    /api/contractors/[id] — fetch one contractor
// PATCH  /api/contractors/[id] — update contractor fields
// DELETE /api/contractors/[id] — delete contractor (fails if assigned to bookings)
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId, getCurrentTeamMember, isFounder } from "@/lib/team";
import { apiSuccess, apiError } from "@/lib/utils";
import type { ContractorUpdate } from "@/lib/supabase/types";

type Params = { params: { id: string } };

// GET /api/contractors/[id]
export async function GET(_req: NextRequest, { params }: Params) {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return apiError("Unauthorized", 401);

  const member = await getCurrentTeamMember();
    const role = member?.role ?? "FOUNDER";
    if (!isFounder(role)) return apiError("Forbidden", 403);

  const ownerUserId = await getOwnerUserId();

  const { data, error } = await supabase
      .from("contractors")
      .select("*")
      .eq("id", params.id)
      .eq("owner_id", ownerUserId)
      .single();

  if (error) {
        return error.code === "PGRST116"
          ? apiError("Contractor not found", 404)
                : apiError(error.message, 500);
  }

  return apiSuccess(data);
}

// PATCH /api/contractors/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return apiError("Unauthorized", 401);

  const member = await getCurrentTeamMember();
    const role = member?.role ?? "FOUNDER";
    if (!isFounder(role)) return apiError("Forbidden", 403);

  const ownerUserId = await getOwnerUserId();

  let body: ContractorUpdate;
    try {
          body = await req.json();
    } catch {
          return apiError("Invalid JSON body");
    }

  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        return apiError("Invalid email address");
  }
    if (body.rate_type && !["HOURLY", "PER_PROJECT"].includes(body.rate_type)) {
          return apiError("Invalid rate_type");
    }

  const { owner_id: _, ...safeBody } = body as any;

  const { data, error } = await supabase
      .from("contractors")
      .update({ ...safeBody, updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .eq("owner_id", ownerUserId)
      .select()
      .single();

  if (error) {
        return error.code === "PGRST116"
          ? apiError("Contractor not found", 404)
                : apiError(error.message, 500);
  }

  return apiSuccess(data);
}

// DELETE /api/contractors/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return apiError("Unauthorized", 401);

  const member = await getCurrentTeamMember();
    const role = member?.role ?? "FOUNDER";
    if (!isFounder(role)) return apiError("Forbidden", 403);

  const ownerUserId = await getOwnerUserId();

  const { count: assignedCount } = await supabase
      .from("booking_contractors")
      .select("id", { count: "exact", head: true })
      .eq("contractor_id", params.id);

  if ((assignedCount ?? 0) > 0) {
        return apiError(
                `Cannot delete — this contractor is assigned to ${assignedCount} booking(s). Remove those assignments first, or mark them inactive instead.`,
                409
              );
  }

  const { error } = await supabase
      .from("contractors")
      .delete()
      .eq("id", params.id)
      .eq("owner_id", ownerUserId);

  if (error) return apiError(error.message, 500);
    return new Response(null, { status: 204 });
}
