// Temporary diagnostic route — remove after fixing env var
export async function GET() {
  const raw = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "";
  const saRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
  const saStripped = saRaw.charCodeAt(0) === 0xfeff ? saRaw.slice(1) : saRaw;

  let saParseOk = false;
  let saParseError = "";
  try {
    JSON.parse(saStripped);
    saParseOk = true;
  } catch (e: any) {
    saParseError = e.message;
  }

  return Response.json({
    deployCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
    rootId: {
      length: raw.length,
      firstCharCode: raw.length > 0 ? raw.charCodeAt(0) : null,
      hasBOM: raw.charCodeAt(0) === 0xfeff,
      valueAfterBOMStrip: raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw,
    },
    serviceAccount: {
      set: saRaw.length > 0,
      length: saRaw.length,
      firstCharCode: saRaw.length > 0 ? saRaw.charCodeAt(0) : null,
      hasBOM: saRaw.charCodeAt(0) === 0xfeff,
      lengthAfterStrip: saStripped.length,
      parseOk: saParseOk,
      parseError: saParseError,
    },
  });
}
