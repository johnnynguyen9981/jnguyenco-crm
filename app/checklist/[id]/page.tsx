// app/checklist/[id]/page.tsx
// Standalone mobile checklist — deliberately outside the (dashboard) route
// group so it renders full-bleed with no sidebar, optimised for a phone
// screen (and for being added to the home screen — the app already ships
// a PWA manifest). Linked from the automatic "night before" reminder email.
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { NIGHT_BEFORE_CHECKLIST } from "@/lib/checklist/nightBeforeItems";
import { ChecklistClient } from "./ChecklistClient";

type Props = { params: { id: string } };

export default async function ChecklistPage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/checklist/${params.id}`);

  const { data: booking, error } = await supabase
    .from("bookings")
    .select(`id, event_date, service_type, checklist_state, clients (first_name, last_name)`)
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (error || !booking) notFound();

  const client = (booking as any).clients;
  const clientName = client ? `${client.first_name} ${client.last_name}` : "Event";

  return (
    <ChecklistClient
      bookingId={booking.id}
      clientName={clientName}
      eventDate={booking.event_date}
      sections={NIGHT_BEFORE_CHECKLIST}
      initialState={booking.checklist_state ?? {}}
    />
  );
}
