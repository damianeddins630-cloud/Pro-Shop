import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createProduct, listProducts } from "@/lib/store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const admin = searchParams.get("admin") === "1";
  if (admin) {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ products: await listProducts({ includeInactive: true }) });
  }
  return NextResponse.json({ products: await listProducts() });
}

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().default(""),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
  category: z.string().default("Accessories"),
  brand: z.string().default("Ballard's Bowling"),
  image: z.string().min(1),
  featured: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = createSchema.parse(await req.json());
    const slug =
      body.slug ||
      body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    const product = await createProduct({
      name: body.name,
      slug,
      description: body.description,
      price: body.price,
      stock: body.stock,
      category: body.category,
      brand: body.brand,
      image: body.image,
      featured: body.featured ?? false,
      active: body.active ?? true,
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
