import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["msedge-tts"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The app is never meant to be framed — it handles minors' records.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Oral-reading exercises need the microphone; nothing else is allowed,
          // and no third-party frame may request it.
          {
            key: "Permissions-Policy",
            value: "microphone=(self), camera=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
