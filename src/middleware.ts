import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "bba_session";
const DEFAULT_DEV_SECRET = "ballards-bowling-academy-dev-secret-change-me";

function authSecretBytes() {
  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv) return new TextEncoder().encode(fromEnv);
  // Match auth.ts — allow Ops gate with fallback when AUTH_SECRET is unset.
  return new TextEncoder().encode(DEFAULT_DEV_SECRET);
}

/**
 * Edge gate for /ops — real authorization still happens on each API call.
 * Unauthenticated browsers are sent to login instead of downloading Ops UI.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/ops")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  const secret = authSecretBytes();
  if (!secret) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    const res = NextResponse.redirect(login);
    res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
    return res;
  }
}

export const config = {
  matcher: ["/ops/:path*"],
};
