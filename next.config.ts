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
};

export default nextConfig;
