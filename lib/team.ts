// lib/team.ts — Team member role helpers (server-side only)
import { createClient } from "@/lib/supabase/server";

export type TeamRole = "FOUNDER" | "PHOTOGRAPHER" | "VIDEOGRAPHER" | "BOTH";

export interface TeamMemberInfo {
    user_id: string;
    full_name: string;
    title: string | null;
    role: TeamRole;
    is_active: boolean;
}

/**
 * Returns the current logged-in team member's info.
 * Returns null if the user is not in team_members (shouldn't happen in practice).
 */
export async function getCurrentTeamMember(): Promise<TeamMemberInfo | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

  const { data } = await supabase
      .from("team_members")
      .select("user_id, full_name, title, role, is_active")
      .eq("user_id", user.id)
      .single();

  return data ?? null;
}

/**
 * Returns the owner (FOUNDER) user_id to use in Supabase queries.
 *
 * All CRM data is stored with owner_id = Johnny's (FOUNDER's) user.id.
 * When a staff member (e.g. Thujey) logs in, their user.id differs,
 * so we look up the FOUNDER's user_id and use that for all data queries.
 *
 * If the current user IS the founder, returns their own user.id directly.
 */
export async function getOwnerUserId(): Promise<string> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

  const { data: member } = await supabase
      .from("team_members")
      .select("role")
      .eq("user_id", user.id)
      .single();

  // If founder (or not in team_members), use their own id
  if (!member || member.role === "FOUNDER") return user.id;

  // Staff: find the FOUNDER's user_id
  const { data: founder } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("role", "FOUNDER")
      .eq("is_active", true)
      .not("user_id", "is", null)
      .single();

  return founder?.user_id ?? user.id;
}

/** Returns true if the role has full admin access */
export function isFounder(role: TeamRole | string | null | undefined): boolean {
    return role === "FOUNDER";
}

/** Nav paths that VIDEOGRAPHER / PHOTOGRAPHER are redirected away from */
export const STAFF_RESTRICTED_PATHS = [
    "/invoices",
    "/expenses",
    "/settings",
    "/documents",
    "/forms",
    "/enquiries",
    "/contractors",
  ];

/** Nav items visible to staff (non-founders) */
export const STAFF_NAV_ALLOWLIST = ["/", "/clients", "/bookings"];
