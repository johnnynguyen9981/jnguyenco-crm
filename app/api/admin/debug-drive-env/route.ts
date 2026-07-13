// Temporary diagnostic route — remove after fixing env var
export async function GET() {
  const raw = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "";
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
  return Response.json({
    rootId: {
      length: raw.length,
      firstCharCode: raw.length > 0 ? raw.charCodeAt(0) : null,
      hasBOM: raw.charCodeAt(0) === 0xfeff,
      valueAfterBOMStrip: raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw,
      lengthAfterBOMStrip: (raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw).length,
    },
    serviceAccount: {
      set: saJson.length > 0,
      length: saJson.length,
    },
  });
}
