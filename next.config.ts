import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingIncludes: {
    "/*": ["./src/assets/share/**/*"],
  },
  redirects() {
    return [{
      source: "/:path*",
      has: [{ type: "host", value: "www\\.eagleevals\\.com" }],
      destination: "https://eagleevals.com/:path*",
      permanent: true,
    }];
  },
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
