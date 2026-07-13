/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    GOOGLE_SERVICE_ACCOUNT_B64: process.env.GOOGLE_SERVICE_ACCOUNT_B64 ?? "",
    GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "",
    GOOGLE_DRIVE_ROOT_FOLDER_ID: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "",
  },
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
