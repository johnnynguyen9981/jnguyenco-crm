// POST /api/bookings/[id]/contractors — assign a contractor to this booking
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId, getCurrentTeamMember, isFounder } from "@/lib/team";
import { apiSuccess, apiError } from "@/lib/utils";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const member = await getCurrentTeamMember();
  const role = member?.role ?? "FOUNDER";
  if (!isFounder(role)) return apiError("Forbidden", 403);

  const ownerUserId = await getOwnerUserId();

  let body: { contractor_id?: string; role?: string; agreed_rate?: number | null; notes?: string };
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }

  if (!body.contractor_id) return apiError("contractor_id is required");
  if (!body.role) return apiError("role is required");

  // Verify the booking belongs to this owner
  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select("id")
    .eq("id", params.id)
    .eq("owner_id", ownerUserId)
    .single();
  if (bookingErr || !booking) return apiError("Booking not found", 404);

  // Verify the contractor belongs to this owner and is active
  const { data: contractor, error: contractorErr } = await supabase
    .from("contractors")
    .select("id, is_active")
    .eq("id", body.contractor_id)
    .eq("owner_id", ownerUserId)
    .single();
  if (contractorErr || !contractor) return apiError("Contractor not found", 404);
  if (!contractor.is_active) return apiError("This contractor is marked inactive.");

  const { data, error } = await supabase
    .from("booking_contractors")
    .insert({
      booking_id: params.id,
      contractor_id: body.contractor_id,
      role: body.role,
      agreed_rate: body.agreed_rate ?? null,
      notes: body.notes ?? null,
    })
    .select("id, role, agreed_rate, confirmed, paid, contractors (id, first_name, last_name, email, phone, role)")
    .single();

  if (error) return apiError(error.message, 500);
  return apiSuccess(data, 201);
}
