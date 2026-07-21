import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByLogin } from "@/lib/store";
import { createSession, toPublicUser, verifyPassword } from "@/lib/auth";

const schema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const user = await findUserByLogin(body.login);
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Invalid username/email or password" },
        { status: 401 }
      );
    }
    await createSession({
      userId: user.id,
      role: user.role,
      username: user.username,
      email: user.email,
    });
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
