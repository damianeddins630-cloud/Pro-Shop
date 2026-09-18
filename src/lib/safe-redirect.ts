/** Client-safe redirect helpers (no NextResponse). */

/** Safe post-login path — blocks open redirects like //evil.com */
export function safeRedirectPath(
  raw: string | null | undefined,
  fallback = "/profile"
): string {
  if (!raw) return fallback;
  const path = String(raw).trim();
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//") || path.startsWith("/\\")) return fallback;
  if (path.includes("://")) return fallback;
  if (/[\u0000-\u001F\u007F]/.test(path)) return fallback;
  if (!/^\/[A-Za-z0-9\-._~!$&'()*+,;=:@/%?]*$/.test(path)) return fallback;
  return path;
}
