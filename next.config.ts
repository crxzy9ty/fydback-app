import type { NextConfig } from "next";

// Deliberately NOT a full Content-Security-Policy: a restrictive script/
// connect policy would block the browser's own calls to Supabase (set-password
// uses the browser client) unless every origin were listed and kept in sync.
// These headers cover what was actually missing without that risk:
//   - frame-ancestors / X-Frame-Options stop the login and admin pages being
//     embedded in another site's frame (clickjacking).
//   - nosniff and the referrer policy are safe defaults with no app impact.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
