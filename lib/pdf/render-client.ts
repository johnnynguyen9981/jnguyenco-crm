// Thin fetch wrapper used by App Router routes to reach the Pages Router
// PDF-rendering endpoints under pages/api/pdf/*.ts.
//
// Why this indirection exists: @react-pdf/renderer's renderToBuffer() builds
// its element tree with the exact same "react" package it requires
// internally, but any module reachable from an App Router route handler gets
// compiled through Next's app-router "react-server" webpack condition, which
// resolves `react` to a Server-Components-only build missing the reconciler
// internals react-pdf needs. Two different `react` module instances in the
// same process means every element react-pdf is asked to render gets
// rejected by its own reconciler as "not a valid React child" (Minified
// React error #31) — see pages/api/bookings/[id]/contractors/[assignmentId]/
// call-sheet.ts for the first documented repro of this.
//
// Rather than moving each route's full auth/DB/email/Drive logic into the
// Pages Router (a much larger, riskier change), only the actual
// renderToBuffer() call site lives in pages/api/pdf/*.ts — a separate
// webpack bundle Next builds outside the app-router module graph. Route
// handlers reach it over a same-process HTTP loopback call, which is real
// process isolation, not just a different import path.
export async function renderPdfInternal(
  path: string,
  payload: unknown,
  requestUrl: string
): Promise<Buffer> {
  const res = await fetch(new URL(path, requestUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `PDF render failed (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}
