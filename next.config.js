/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone output is required for Electron desktop packaging.
  // NEVER set this when deploying to Vercel — it causes instant build failure.
  // Only enable it locally when building the desktop app: NEXT_OUTPUT=standalone npm run build
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
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
