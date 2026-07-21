import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSponsor, listSponsors } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ sponsors: await listSponsors() });
}

const schema = z.object({
  name: z.string().min(1),
  image: z.string().min(1),
  url: z.string().default("#"),
});

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = schema.parse(await req.json());
    const sponsor = await createSponsor(body);
    return NextResponse.json({ sponsor }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
