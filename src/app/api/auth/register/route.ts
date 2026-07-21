import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser } from "@/lib/store";
import { createSessionForUser, toPublicUser } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32),
  password: z.string().min(6).max(128),
  phoneNumber: z.string().min(7).max(32),
  dateOfBirth: z.string().min(4),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const user = await createUser(body);
    await createSessionForUser(user);
    return NextResponse.json({ user: await toPublicUser(user) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
