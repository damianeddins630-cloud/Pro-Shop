import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByLogin } from "@/lib/store";
import { createSessionForUser, toPublicUser, verifyPassword } from "@/lib/auth";

const schema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const login = String(body.login).trim();
    const password = String(body.password);
    const user = await findUserByLogin(login);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Invalid username/email or password" },
        { status: 401 }
      );
    }
    await createSessionForUser(user);
    // Prefer profile so the signed-in user always lands on their account
    return NextResponse.json({ user: await toPublicUser(user) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
