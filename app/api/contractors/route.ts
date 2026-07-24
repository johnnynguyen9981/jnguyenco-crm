// GET  /api/contractors — list all contractors (with search + pagination)
// POST /api/contractors — create a new contractor
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerUserId, getCurrentTeamMember, isFounder } from "@/lib/team";
import { apiSuccess, apiError } from "@/lib/utils";
import type { ContractorInsert } from "@/lib/supabase/types";

// GET /api/contractors
export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return apiError("Unauthorized", 401);

  const member = await getCurrentTeamMember();
    const role = member?.role ?? "FOUNDER";
    if (!isFounder(role)) return apiError("Forbidden", 403);

  const ownerUserId = await getOwnerUserId();

  const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit  = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));
    const offset = (page - 1) * limit;

  let query = supabase
      .from("contractors")
      .select("*", { count: "exact" })
      .eq("owner_id", ownerUserId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

  if (search) {
        query = query.or(
                `first_name.ilike.%${search}%,` +
                `last_name.ilike.%${search}%,` +
                `email.ilike.%${search}%`
              );
  }

  const { data, error, count } = await query;
    if (error) return apiError(error.message, 500);

  return apiSuccess({
        contractors: data,
        pagination: {
                total: count ?? 0,
                page,
                limit,
                pages: Math.ceil((count ?? 0) / limit),
        },
  });
}

// POST /api/contractors
export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return apiError("Unauthorized", 401);

  const member = await getCurrentTeamMember();
    const role = member?.role ?? "FOUNDER";
    if (!isFounder(role)) return apiError("Forbidden", 403);

  const ownerUserId = await getOwnerUserId();

  let body: ContractorInsert;
    try {
          body = await req.json();
    } catch {
          return apiError("Invalid JSON body");
    }

  if (!body.first_name?.trim()) return apiError("first_name is required");
    if (!body.last_name?.trim())  return apiError("last_name is required");
    if (!body.role)               return apiError("role is required");
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
          return apiError("Invalid email address");
    }
    if (body.rate_type && !["HOURLY", "PER_PROJECT"].includes(body.rate_type)) {
          return apiError("Invalid rate_type");
    }

  const { data, error } = await supabase
      .from("contractors")
      .insert({
              ...body,
              email:      body.email ? body.email.toLowerCase().trim() : null,
              owner_id:   ownerUserId,
              is_active:  body.is_active ?? true,
      })
      .select()
      .single();

  if (error) return apiError(error.message, 500);
    return apiSuccess(data, 201);
}
