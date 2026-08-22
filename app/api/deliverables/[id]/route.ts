// PATCH /api/deliverables/[id]
// Updates a single deliverable's status (used by the status dropdown on the
// Deliverables list page and the booking detail page). Auto-stamps
// delivered_at the first time a deliverable moves to DELIVERED.
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/utils";
import type { DeliverableStatus } from "@/lib/supabase/types";

const VALID_STATUSES: DeliverableStatus[] = [
  "NOT_STARTED",
  "CULLING",
  "EDITING",
  "READY",
  "DELIVERED",
  "CLIENT_APPROVED",
];

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const status = body.status as DeliverableStatus;

  if (!status || !VALID_STATUSES.includes(status)) {
    return apiError("Invalid status", 400);
  }

  const { data: existing } = await supabase
    .from("deliverables")
    .select("id, status, delivered_at")
    .eq("id", params.id)
    .single();

  if (!existing) return apiError("Deliverable not found", 404);

  const update: Record<string, any> = { status };
  if (status === "DELIVERED" && !existing.delivered_at) {
    update.delivered_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("deliverables")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return apiError(error.message, 500);

  return apiSuccess(data);
}
