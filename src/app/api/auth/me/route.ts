import { NextResponse } from "next/server";
import { getSession, toPublicUser } from "@/lib/auth";
import { findUserById } from "@/lib/store";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });
  const user = await findUserById(session.userId);
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: toPublicUser(user) });
}
