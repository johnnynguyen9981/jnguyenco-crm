// POST /api/bookings/[id]/deliverables
// Auto-populates deliverables for a booking based on its package.
// Idempotent — skips types that already exist on the booking.
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/utils";
import { getDeliverableTemplates, addDaysToDate } from "@/lib/deliverables/autoPopulate";

type Params = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  // Load booking with package info
  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select(`
      id, event_date, service_type, owner_id,
      packages (id, name),
      deliverables (type)
    `)
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (bErr || !booking) return apiError("Booking not found", 404);

  const pkg         = (booking as any).packages;
  const packageName = pkg?.name ?? "";
  const serviceType = booking.service_type ?? "EVENT";
  const eventDate   = booking.event_date;

  // Get template list
  const templates = getDeliverableTemplates(packageName, serviceType);

  // Find which types already exist (avoid duplicates)
  const existingTypes = new Set(
    ((booking as any).deliverables ?? []).map((d: any) => d.type)
  );

  const toInsert = templates
    .filter(t => !existingTypes.has(t.type))
    .map(t => ({
      owner_id:          user.id,
      booking_id:        params.id,
      type:              t.type,
      status:            "NOT_STARTED" as const,
      notes:             t.notes,
      due_date:          eventDate ? addDaysToDate(eventDate, t.due_days_after) : null,
      image_count:       t.image_count_max ?? null,
      film_duration_sec: t.film_duration_sec ?? null,
    }));

  if (toInsert.length === 0) {
    return apiSuccess({ created: 0, message: "All deliverables already exist" });
  }

  const { data, error } = await supabase
    .from("deliverables")
    .insert(toInsert)
    .select();

  if (error) return apiError(error.message, 500);

  return apiSuccess({ created: data.length, deliverables: data }, 201);
}
