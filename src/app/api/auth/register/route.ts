import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser, storePersistStatus } from "@/lib/store";
import { createSessionForUser, toPublicUser } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/security";

const schema = z.object({
  email: z.string().email().max(120),
  username: z.string().min(3).max(32),
  password: z.string().min(10).max(128),
  phoneNumber: z.string().min(7).max(32),
  dateOfBirth: z.string().min(4).max(32),
});

export async function POST(req: Request) {
  try {
    const limited = rateLimit(`register:${clientIp(req)}`, 8, 60 * 60 * 1000);
    if (limited) return limited;

    if (process.env.VERCEL && !storePersistStatus().durableWriteConfigured) {
      return NextResponse.json(
        {
          error:
            "Account saving is not set up yet (missing durable storage in Vercel). Please contact the site owner.",
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
        },
        { status: 400 }
      );
    }
    const user = await createUser(parsed.data);
    await createSessionForUser(user);
    return NextResponse.json(
      { user: await toPublicUser(user) },
      { status: 201 }
    );
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Registration failed";
    const lower = raw.toLowerCase();
    const missingPersist =
      lower.includes("github_token") ||
      lower.includes("durable") ||
      lower.includes("blob") ||
      lower.includes("persist");
    const duplicate =
      lower.includes("already registered") || lower.includes("already exists");
    const publicError = missingPersist
      ? "Account saving is not set up yet. Please contact the site owner."
      : duplicate
        ? "An account with that email or username already exists."
        : raw.includes("AUTH_SECRET") ||
            lower.includes("ops") ||
            lower.includes("env")
          ? "Registration is temporarily unavailable. Please try again shortly."
          : raw;
    return NextResponse.json(
      { error: publicError },
      { status: missingPersist ? 503 : 400 }
    );
  }
}
