// lib/pdf/renderQueue.ts
//
// @react-pdf/renderer is not safe to call concurrently within the same
// Node.js process: its layout engine and font registry are shared
// module-level state, so two renderToBuffer() calls that overlap in time on
// the same warm serverless instance can corrupt each other's render tree.
// The observed symptom is exactly this kind of cross-talk: a crash deep
// inside react-pdf's internals ("Objects are not valid as a React child",
// invariant #31) on a document whose own data is completely valid and
// reproduces fine in isolation — because the object it chokes on didn't
// come from this render at all, it leaked in from a different one that was
// running on the same process at the same moment.
//
// This app has five separate templates riding on @react-pdf/renderer
// (contracts, contractor agreements, quotes, run sheets, call sheets) plus
// the receipt and invoice routes — any two of them (or two calls to the
// same one) can land on the same warm Vercel instance close together. Every
// call site imports `renderToBuffer` from here instead of directly from
// "@react-pdf/renderer", so at most one render runs at a time per process.
import { renderToBuffer as reactPdfRenderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";

let queue: Promise<unknown> = Promise.resolve();

export function renderToBuffer(element: ReactElement): Promise<Buffer> {
  const run = queue.then(() => reactPdfRenderToBuffer(element as any) as Promise<Buffer>);
  // The queue itself must never reject, or every render after a failed one
  // would inherit that rejection instead of running. Each caller still gets
  // the real result/error via `run`, returned below.
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
