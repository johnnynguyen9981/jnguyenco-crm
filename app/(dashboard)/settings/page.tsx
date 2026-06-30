// app/(dashboard)/settings/page.tsx
// Settings page — Google integration status, connect/disconnect, business info, team.
import { createClient } from "@/lib/supabase/server";
import { isGoogleConnected } from "@/lib/google/auth";
import { GoogleConnectButton } from "./GoogleConnectButton";

const ROLE_LABEL: Record<string, string> = {
  FOUNDER:      "Founder",
  PHOTOGRAPHER: "Photographer",
  VIDEOGRAPHER: "Videographer",
  BOTH:         "Photographer & Videographer",
};

export default async function SettingsPage({ searchParams }: { searchParams: { google?: string; reason?: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const googleConnected = await isGoogleConnected(user.id);

  // Team members
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("id, full_name, title, role, email, user_id, is_active")
    .order("created_at");
  const googleStatus = searchParams.google;  // "connected" | "denied" | "error"
  const googleReason = searchParams.reason ?? "";

  // Fetch token row for display info (no sensitive data shown)
  const { data: tokenRow } = await supabase
    .from("google_tokens")
    .select("created_at, updated_at")
    .eq("owner_id", user.id)
    .single();

  return (
    <div className="max-w-2xl space-y-8">
      {googleStatus === "connected" && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          ✓ Google account connected successfully. Calendar sync and Gmail are now active.
        </div>
      )}
      {googleStatus === "denied" && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg px-4 py-3">
          Google connection was cancelled. You can try again below.
        </div>
      )}
      {googleStatus === "error" && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          <p className="font-medium">Google connection failed.</p>
          {googleReason && <p className="text-xs mt-1 opacity-80">{decodeURIComponent(googleReason)}</p>}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold text-brand-navy">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your integrations and account preferences.</p>
      </div>

      {/* ── Google Integration ── */}
      <div className="card space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-brand-navy">Google Integration</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Connect your Google account to sync bookings to Calendar and send invoices via Gmail.
            </p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
            ${googleConnected
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-gray-100 text-gray-500 border border-gray-200"
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${googleConnected ? "bg-green-500" : "bg-gray-400"}`} />
            {googleConnected ? "Connected" : "Not connected"}
          </div>
        </div>

        {/* Feature list */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: "📅", title: "Google Calendar", desc: "Auto-sync bookings as events. Check availability." },
            { icon: "✉️", title: "Gmail", desc: "Send branded booking confirmations and invoices from your business email." },
          ].map((f) => (
            <div key={f.title}
              className={`rounded-lg p-4 border text-sm
                ${googleConnected ? "border-green-200 bg-green-50/30" : "border-gray-200 bg-gray-50"}`}>
              <p className="text-xl mb-2">{f.icon}</p>
              <p className="font-medium text-brand-navy">{f.title}</p>
              <p className="text-gray-500 text-xs mt-0.5">{f.desc}</p>
              {googleConnected && (
                <p className="text-green-600 text-xs mt-2 font-medium">✓ Active</p>
              )}
            </div>
          ))}
        </div>

        {/* Connection details */}
        {googleConnected && tokenRow && (
          <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Connection Info</p>
            <div className="flex justify-between text-gray-600">
              <span>Connected</span>
              <span>{new Date(tokenRow.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Last refreshed</span>
              <span>{new Date(tokenRow.updated_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Tokens are stored securely server-side and never exposed to the browser.
            </p>
          </div>
        )}

        {/* Scopes granted */}
        {googleConnected && (
          <div className="text-xs text-gray-400 space-y-1">
            <p className="font-medium text-gray-500">Permissions granted:</p>
            <p>• gmail.send — send emails on your behalf</p>
            <p>• calendar.events — create, update, and delete calendar events</p>
          </div>
        )}

        {/* Connect / Disconnect button */}
        <GoogleConnectButton isConnected={googleConnected} />
      </div>

      {/* ── Account ── */}
      <div className="card space-y-4">
        <h2 className="text-base font-semibold text-brand-navy">Account</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">User ID</p>
            <p className="font-mono text-xs text-gray-500 truncate">{user.id}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Last sign-in</p>
            <p className="text-gray-600">
              {user.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Team Members ── */}
      <div className="card space-y-4">
        <div>
          <h2 className="text-base font-semibold text-brand-navy">Team</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Team members can log in and access all CRM data. Run the migration first to enable multi-user access.
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          {(teamMembers ?? []).map((m) => (
            <div key={m.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-navy/10 flex items-center justify-center shrink-0">
                  <span className="text-brand-navy text-sm font-bold">
                    {m.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-brand-navy">{m.full_name}</p>
                  <p className="text-xs text-gray-500">{m.title ?? ROLE_LABEL[m.role] ?? m.role}</p>
                  <p className="text-xs text-gray-400">{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {m.user_id
                  ? <span className="text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Active</span>
                  : <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Pending login</span>
                }
                {m.role === "FOUNDER" && (
                  <span className="text-xs font-medium text-brand-navy/60 bg-brand-navy/5 border border-brand-navy/10 px-2 py-0.5 rounded-full">Founder</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          To add team members, update their emails in{" "}
          <code className="bg-gray-100 px-1 py-0.5 rounded">supabase/migrations/20260625_add_team_support.sql</code>{" "}
          and run it in the Supabase SQL Editor. Team members show as <strong>Active</strong> once they sign in.
        </p>
      </div>

      {/* ── Business Info ── */}
      <div className="card space-y-4">
        <h2 className="text-base font-semibold text-brand-navy">Business Info</h2>
        <p className="text-xs text-gray-400">
          These values are set via environment variables in your <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">.env.local</code> file.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {[
            { label: "Business Name", value: process.env.NEXT_PUBLIC_BUSINESS_NAME },
            { label: "Business Email", value: process.env.NEXT_PUBLIC_BUSINESS_EMAIL },
            { label: "Phone", value: process.env.NEXT_PUBLIC_BUSINESS_PHONE },
            { label: "ABN", value: process.env.NEXT_PUBLIC_BUSINESS_ABN },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{f.label}</p>
              <p className="font-medium">{f.value || <span className="text-gray-300">Not set</span>}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
