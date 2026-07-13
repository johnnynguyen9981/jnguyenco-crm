// Temporary diagnostic route — remove after fixing env var
function stripBOM(s: string) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

export async function GET() {
  const env = process.env as Record<string, string | undefined>;
  const raw     = env["GOOGLE_DRIVE_ROOT_FOLDER_ID"] ?? "";
  const saRaw   = env["GOOGLE_SERVICE_ACCOUNT_JSON"] ?? "";
  const saB64   = env["GOOGLE_SERVICE_ACCOUNT_B64"]  ?? "";
  const saStripped = stripBOM(saRaw);

  // Try to parse whichever source has data (mirrors getDriveClient logic)
  let saResolved = "";
  if (saB64) {
    try { saResolved = Buffer.from(stripBOM(saB64).trim(), "base64").toString("utf8"); } catch {}
  }
  if (!saResolved) saResolved = saStripped.trim();

  let parseOk = false, parseError = "";
  try { JSON.parse(saResolved); parseOk = true; } catch (e: any) { parseError = e.message; }

  const visibleKeys = Object.keys(process.env)
    .filter(k => k.startsWith("GOOGLE") || k.startsWith("VERCEL") || k === "NODE_ENV")
    .sort();

  return Response.json({
    deployCommit: env["VERCEL_GIT_COMMIT_SHA"] ?? "unknown",
    rootId: {
      length: raw.length,
      hasBOM: raw.charCodeAt(0) === 0xfeff,
      valueAfterBOMStrip: stripBOM(raw),
    },
    b64Var: { set: saB64.length > 0, length: saB64.length },
    jsonVar: { set: saRaw.length > 0, length: saRaw.length, hasBOM: saRaw.charCodeAt(0) === 0xfeff },
    resolved: { length: saResolved.length, parseOk, parseError },
    visibleKeys,
  });
}
