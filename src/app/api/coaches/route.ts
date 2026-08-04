import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import { createCoach, listCoaches } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ coaches: await listCoaches() });
}

const schema = z.object({
  name: z.string().min(1),
  image: z.string().default("/images/logo.png"),
  email: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await requireAnyPermission(
    "manage_coaches",
    "edit_pages",
    "manage_roles"
  );
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = schema.parse(await req.json());
    const coach = await createCoach(body);
    return NextResponse.json({ coach }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Create failed" },
      { status: 400 }
    );
  }
}
