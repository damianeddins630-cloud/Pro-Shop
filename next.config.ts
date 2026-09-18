import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self' https://*.activehosted.com https://*.myshopify.com https://checkout.shopify.com",
      "frame-ancestors 'self'",
      "frame-src 'self' https://*.activehosted.com https://*.myshopify.com https://checkout.shopify.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.bunny.net",
      "style-src 'self' 'unsafe-inline' https://fonts.bunny.net",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.activehosted.com",
      "connect-src 'self' https://*.myshopify.com https://*.shopify.com https://*.activehosted.com https://*.vercel-storage.com https://*.blob.vercel-storage.com https://*.upstash.io",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

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
        source: "/:path*",
        headers: securityHeaders,
      },
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
