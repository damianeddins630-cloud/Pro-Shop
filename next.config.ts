import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ballardsbowlingacademy.com",
      },
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
      },
    ],
    // Allow data URLs from admin uploads in next/image via unoptimized on those components
  },
};

export default nextConfig;
