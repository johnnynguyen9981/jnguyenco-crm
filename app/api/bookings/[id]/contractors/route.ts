// POST /api/bookings/[id]/contractors — assign a contractor to this booking
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId, getCurrentTeamMember, isFounder } from "@/lib/team";
import { apiSuccess, apiError } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

// True if a Supabase/PostgREST error means a referenced column doesn't
// exist yet — i.e. the 20260813_booking_contractor_coverage.sql migration
// (rate_type / coverage_start_time / coverage_end_time on
// booking_contractors) hasn't been run in Supabase yet. Lets assignment
// keep working with the older columns only until the migration is applied,
// rather than hard-failing the whole feature.
function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703") return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("schema cache") || (msg.includes("column") && msg.includes("does not exist"));
}

export async function POST(req: NextRequest, props: Params) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return apiError("Unauthorized", 401);

  const member = await getCurrentTeamMember();
  const role = member?.role ?? "FOUNDER";
  if (!isFounder(role)) return apiError("Forbidden", 403);

  const ownerUserId = await getOwnerUserId();

  let body: {
    contractor_id?: string;
    role?: string;
    agreed_rate?: number | null;
    notes?: string;
    rate_type?: "HOURLY" | "PER_PROJECT" | null;
    coverage_start_time?: string | null;
    coverage_end_time?: string | null;
    deadline?: string | null;
  };
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

  const baseInsert = {
    booking_id: params.id,
    contractor_id: body.contractor_id,
    role: body.role,
    agreed_rate: body.agreed_rate ?? null,
    notes: body.notes ?? null,
  };
  const coverageFields = {
    rate_type: body.rate_type ?? null,
    coverage_start_time: body.coverage_start_time ?? null,
    coverage_end_time: body.coverage_end_time ?? null,
    deadline: body.deadline ?? null,
  };
  const selectCols = "id, role, agreed_rate, confirmed, paid, deadline, work_received_at, contractors (id, first_name, last_name, email, phone, role)";

  let { data, error } = await supabase
    .from("booking_contractors")
    .insert({ ...baseInsert, ...coverageFields })
    .select(selectCols)
    .single();

  // The rate_type/coverage columns don't exist yet (migration not run) —
  // retry with just the original fields so assigning crew still works.
  if (error && isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from("booking_contractors")
      .insert(baseInsert)
      .select(selectCols)
      .single());
  }

  // work_received_at doesn't exist yet either (20260828 migration not run) —
  // drop it from the select too so assigning crew still works.
  if (error && isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from("booking_contractors")
      .insert(baseInsert)
      .select(selectCols.replace(", work_received_at", ""))
      .single());
  }

  if (error) return apiError(error.message, 500);
  return apiSuccess(data, 201);
}
