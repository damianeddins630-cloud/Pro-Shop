import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure seed/data files are included in Vercel serverless bundles
  outputFileTracingIncludes: {
    "/*": ["./data/**/*", "./src/data/**/*"],
  },
  images: {
    // Local public/ assets work without the optimizer; avoids edge cases on free plans
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "ballardsbowlingacademy.com" },
      { protocol: "https", hostname: "cdn.shopify.com" },
    ],
  },
  async redirects() {
    return [
      { source: "/admin", destination: "/ops", permanent: true },
      { source: "/admin/:path*", destination: "/ops", permanent: true },
      { source: "/images/site-bg.gif", destination: "/images/venue-still.jpg", permanent: true },
      { source: "/images/site-bg.jpg", destination: "/images/venue-still.jpg", permanent: true },
      { source: "/images/site-bg.png", destination: "/images/venue-still.jpg", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/images/venue-still.jpg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
