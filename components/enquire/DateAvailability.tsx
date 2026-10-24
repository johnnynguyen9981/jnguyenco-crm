"use client";
// Advisory availability message shown under the Event Date field on both enquiry forms
// (/enquire and /enquire/embed). It never blocks submission and shows nothing if the check
// fails or returns "unknown".
import { useEffect, useState } from "react";

type Status = "available" | "limited" | "contact";

const STYLES: Record<Status, string> = {
  available: "bg-green-50 border-green-200 text-green-800",
  limited:   "bg-amber-50 border-amber-200 text-amber-800",
  contact:   "bg-sky-50 border-sky-200 text-sky-800",
};

export function DateAvailability({ date, eventType }: { date: string; eventType: string }) {
  const [result, setResult] = useState<{ status: Status; message: string } | null>(null);

  useEffect(() => {
    setResult(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

    const controller = new AbortController();
    // Small delay so typing or scrolling through dates doesn't fire a request per change.
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ date, type: eventType });
        const res = await fetch("/api/enquire/availability?" + qs.toString(), { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.status === "available" || data?.status === "limited" || data?.status === "contact") {
          setResult({ status: data.status, message: String(data.message ?? "") });
        }
      } catch {
        // Aborted or network error: show nothing.
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [date, eventType]);

  return (
    <div aria-live="polite">
      {result && result.message && (
        <p className={"text-sm border rounded-lg px-3 py-2 mt-3 " + STYLES[result.status]}>{result.message}</p>
      )}
    </div>
  );
}
