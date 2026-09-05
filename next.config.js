/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only the desktop (Electron) build needs a standalone server bundle —
  // build-desktop.bat sets ELECTRON_BUILD=true and copies .next/standalone
  // into the packaged app. Leaving this unset for the normal `npm run build`
  // keeps the Vercel deployment on Next's default output.
  ...(process.env.ELECTRON_BUILD === "true" ? { output: "standalone" } : {}),
  env: {
    GOOGLE_SERVICE_ACCOUNT_B64: process.env.GOOGLE_SERVICE_ACCOUNT_B64 ?? "",
    GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "",
    GOOGLE_DRIVE_ROOT_FOLDER_ID: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "",
  },
  serverExternalPackages: ["@react-pdf/renderer"],
  // PDF generation (invoices, contracts, quotes, receipts, call sheets —
  // see lib/generate-*.tsx and lib/pdf/*.tsx) reads font/logo files via
  // path.join(process.cwd(), "public", ...) at runtime. Next's build-time
  // file tracer can't resolve a process.cwd()-based path statically, so
  // without this, those files silently don't make it into the deployed
  // serverless function on Vercel — the routes work fine locally (cwd is
  // the project root either way) and fail in production with an ENOENT
  // buried inside @react-pdf's renderer, surfacing as a generic
  // "Failed to generate ..." error with no obvious cause.
  outputFileTracingIncludes: {
    "/api/**/*": ["./public/fonts/**", "./public/PNG/**", "./public/signature.png"],
  },
  async headers() {
    return [
      {
        // Allow /enquire/embed to be loaded inside a Squarespace iframe
        source: "/enquire/embed",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
