/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" bundles the server for Electron desktop packaging.
  // Vercel ignores this and uses its own build pipeline — web deploy is unaffected.
  output: "standalone",
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
