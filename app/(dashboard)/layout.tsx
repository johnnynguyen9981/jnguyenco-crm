// app/(dashboard)/layout.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Sidebar } from "@/components/layout/Sidebar";
import { getCurrentTeamMember, STAFF_RESTRICTED_PATHS } from "@/lib/team";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch team member role to enforce path restrictions
  const member = await getCurrentTeamMember();
  const role = member?.role ?? "FOUNDER";

  // Non-founders get bounced away from admin-only sections
  if (role !== "FOUNDER") {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") ?? "";
    const isRestricted = STAFF_RESTRICTED_PATHS.some(p => pathname.startsWith(p));
    if (isRestricted) redirect("/bookings");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role={role} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
