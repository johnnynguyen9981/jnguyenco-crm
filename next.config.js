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
