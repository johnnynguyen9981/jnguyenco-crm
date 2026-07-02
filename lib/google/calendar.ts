// ─────────────────────────────────────────────────────────────────────────────
// Google Calendar API helpers
// ─────────────────────────────────────────────────────────────────────────────
import { google } from "googleapis";
import { getAuthenticatedClient } from "./auth";
import type { Booking, Client } from "@/lib/supabase/types";
import { formatDate } from "@/lib/utils";

// JNguyen Co. Photography, Videography Booking calendar
const BOOKING_CALENDAR_ID =
  "b3c07750835316cae4b43752e8426c76cbd2250ce727d80f6cf3ea9646e83bee@group.calendar.google.com";

export interface CalendarSyncResult {
  gcal_event_id: string;
  html_link: string;
}

/**
 * Create or update a Google Calendar event for a booking.
 * Returns the Google Calendar event ID to store in bookings.gcal_event_id.
 */
export async function syncBookingToCalendar(
  userId: string,
  booking: Booking,
  client: Pick<Client, "first_name" | "last_name" | "email">
): Promise<CalendarSyncResult> {
  const authClient = await getAuthenticatedClient(userId);
  const calendar   = google.calendar({ version: "v3", auth: authClient });

  const clientName  = `${client.first_name} ${client.last_name}`;
  const serviceLabel = booking.service_type === "WEDDING"
    ? "💍 Wedding"
    : booking.service_type === "EVENT"
    ? "🎉 Event"
    : "📸 Portrait";

  // Build start/end datetime strings
  // Postgres 'time' columns return "HH:MM:SS" — slice to "HH:MM" before appending seconds
  const startDate = booking.event_date; // 'YYYY-MM-DD'
  const startTime = (booking.event_start_time ?? "08:00").substring(0, 5);
  const endTime   = (booking.event_end_time   ?? "17:00").substring(0, 5);
  const startDateTime = `${startDate}T${startTime}:00`;
  const endDateTime   = `${startDate}T${endTime}:00`;
  const timeZone      = "Australia/Sydney";

  const eventBody = {
    summary: `${serviceLabel} — ${clientName}`,
    description: [
      `Client: ${clientName} (${client.email})`,
      booking.venue_name   ? `Venue: ${booking.venue_name}`     : null,
      booking.venue_address ? `Address: ${booking.venue_address}` : null,
      booking.ceremony_venue   ? `Ceremony: ${booking.ceremony_venue}`     : null,
      booking.reception_venue  ? `Reception: ${booking.reception_venue}`   : null,
      booking.quoted_total ? `Quoted: $${booking.quoted_total.toLocaleString()}` : null,
      booking.special_requests ? `\nNotes: ${booking.special_requests}` : null,
      `\nStatus: ${booking.status}`,
      `\nManage: ${process.env.NEXT_PUBLIC_APP_URL}/bookings/${booking.id}`,
    ]
      .filter(Boolean)
      .join("\n"),
    start: { dateTime: startDateTime, timeZone },
    end:   { dateTime: endDateTime,   timeZone },
    colorId: booking.service_type === "WEDDING" ? "6" : "5", // pink for weddings, banana for events
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email",  minutes: 24 * 60 * 7 }, // 1 week before
        { method: "popup",  minutes: 24 * 60 },      // 1 day before
      ],
    },
  };

  // Update existing event if we have an ID, otherwise create a new one
  if (booking.gcal_event_id) {
    const res = await calendar.events.update({
      calendarId:  BOOKING_CALENDAR_ID,
      eventId:     booking.gcal_event_id,
      requestBody: eventBody,
    });
    return {
      gcal_event_id: res.data.id!,
      html_link:     res.data.htmlLink!,
    };
  } else {
    const res = await calendar.events.insert({
      calendarId:  BOOKING_CALENDAR_ID,
      requestBody: eventBody,
    });
    return {
      gcal_event_id: res.data.id!,
      html_link:     res.data.htmlLink!,
    };
  }
}

/**
 * Delete a calendar event when a booking is cancelled.
 */
export async function deleteCalendarEvent(
  userId: string,
  gcalEventId: string
): Promise<void> {
  const authClient = await getAuthenticatedClient(userId);
  const calendar   = google.calendar({ version: "v3", auth: authClient });
  await calendar.events.delete({ calendarId: BOOKING_CALENDAR_ID, eventId: gcalEventId });
}

/**
 * Check whether a date is already booked (busy check against primary calendar).
 * Returns true if there are conflicting events on that date.
 */
export async function isDateBusy(
  userId: string,
  date: string,           // 'YYYY-MM-DD'
  startTime = "00:00",
  endTime   = "23:59"
): Promise<boolean> {
  const authClient = await getAuthenticatedClient(userId);
  const calendar   = google.calendar({ version: "v3", auth: authClient });

  const timeMin = `${date}T${startTime}:00+11:00`;
  const timeMax = `${date}T${endTime}:00+11:00`;

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    },
  });

  const busy = res.data.calendars?.["primary"]?.busy ?? [];
  return busy.length > 0;
}
