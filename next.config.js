/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" bundles the server for Electron desktop packaging.
  // Vercel ignores this and uses its own build pipeline — web deploy is unaffected.
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
};

module.exports = nextConfig;
