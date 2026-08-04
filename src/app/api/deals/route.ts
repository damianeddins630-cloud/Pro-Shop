import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import { createDeal, listDeals } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ deals: await listDeals() });
}

const schema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  image: z.string().min(1),
  active: z.boolean().optional(),
  featured: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await requireAnyPermission("manage_deals", "edit_pages");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = schema.parse(await req.json());
    const deal = await createDeal({
      title: body.title,
      description: body.description,
      image: body.image,
      active: body.active ?? true,
      featured: body.featured ?? false,
    });
    return NextResponse.json({ deal }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
