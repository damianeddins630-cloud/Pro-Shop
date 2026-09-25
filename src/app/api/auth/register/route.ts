import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createUser,
  lastPersistSucceeded,
  storePersistStatus,
} from "@/lib/store";
import { createSessionForUser, toPublicUser } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/security";

const schema = z.object({
  email: z.string().email().max(120),
  username: z.string().min(3).max(32),
  password: z.string().min(10).max(128),
  phoneNumber: z.string().min(7).max(32),
  dateOfBirth: z.string().min(4).max(32),
});

function isProductionRuntime() {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}

export async function POST(req: Request) {
  try {
    const limited = rateLimit(`register:${clientIp(req)}`, 8, 60 * 60 * 1000);
    if (limited) return limited;

    // Fail closed before writing an account that cannot get a session cookie.
    if (isProductionRuntime() && !process.env.AUTH_SECRET?.trim()) {
      return NextResponse.json(
        {
          error:
            "Registration is temporarily unavailable. Please try again shortly.",
          code: "AUTH_MISCONFIGURED",
        },
        { status: 503 }
      );
    }

    if (process.env.VERCEL && !storePersistStatus().durableWriteConfigured) {
      return NextResponse.json(
        {
          error:
            "Account saving is not set up yet (missing durable storage in Vercel). Please contact the site owner.",
          code: "DURABLE_STORAGE_MISSING",
        },
        { status: 503 }
      );
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Please provide a valid email, username (3+ characters), password (10+ characters), phone number, and date of birth.",
          code: "VALIDATION",
        },
        { status: 400 }
      );
    }

    const user = await createUser(parsed.data);

    // On Vercel, refuse success if the account did not land in durable storage.
    if (process.env.VERCEL && !lastPersistSucceeded()) {
      return NextResponse.json(
        {
          error:
            "Account saving is not set up yet. Please contact the site owner.",
          code: "DURABLE_STORAGE_FAILED",
        },
        { status: 503 }
      );
    }

    await createSessionForUser(user);
    return NextResponse.json(
      { user: await toPublicUser(user) },
      { status: 201 }
    );
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Registration failed";
    const lower = raw.toLowerCase();

    if (raw.includes("AUTH_SECRET") || lower.includes("auth_secret")) {
      return NextResponse.json(
        {
          error:
            "Registration is temporarily unavailable. Please try again shortly.",
          code: "AUTH_MISCONFIGURED",
        },
        { status: 503 }
      );
    }

    const missingPersist =
      lower.includes("github_token") ||
      lower.includes("durable") ||
      lower.includes("blob") ||
      lower.includes("persist") ||
      lower.includes("account saving is not set up");
    if (missingPersist) {
      return NextResponse.json(
        {
          error:
            "Account saving is not set up yet. Please contact the site owner.",
          code: "DURABLE_STORAGE_MISSING",
        },
        { status: 503 }
      );
    }

    const duplicate =
      lower.includes("already registered") ||
      lower.includes("already exists") ||
      lower.includes("already taken");
    if (duplicate) {
      return NextResponse.json(
        {
          error: "An account with that email or username already exists.",
          code: "DUPLICATE",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Registration failed. Please try again.",
        code: "REGISTER_FAILED",
      },
      { status: 400 }
    );
  }
}
