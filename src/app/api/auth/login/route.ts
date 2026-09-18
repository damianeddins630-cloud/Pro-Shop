import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByLogin } from "@/lib/store";
import { createSessionForUser, toPublicUser, verifyPassword } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/security";

const schema = z.object({
  login: z.string().min(1).max(120),
  password: z.string().min(1).max(128),
});

export async function POST(req: Request) {
  try {
    const limited = rateLimit(`login:${clientIp(req)}`, 20, 15 * 60 * 1000);
    if (limited) return limited;

    const body = schema.parse(await req.json());
    const login = String(body.login).trim();
    const password = String(body.password);

    const perUser = rateLimit(
      `login-user:${login.toLowerCase()}`,
      10,
      15 * 60 * 1000
    );
    if (perUser) return perUser;

    const user = await findUserByLogin(login);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Invalid username/email or password" },
        { status: 401 }
      );
    }
    await createSessionForUser(user);
    return NextResponse.json({ user: await toPublicUser(user) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
