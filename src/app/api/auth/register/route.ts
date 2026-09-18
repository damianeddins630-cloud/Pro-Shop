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
    const body = schema.parse(await req.json());
    const user = await createUser(body);
    await createSessionForUser(user);
    return NextResponse.json(
      { user: await toPublicUser(user) },
      { status: 201 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registration failed";
    const missingPersist = message.toLowerCase().includes("github_token");
    return NextResponse.json(
      { error: message },
      { status: missingPersist ? 503 : 400 }
    );
  }
}
