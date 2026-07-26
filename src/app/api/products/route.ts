import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import {
  createProduct,
  listProducts,
  storePersistStatus,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const admin = searchParams.get("admin") === "1";
  if (admin) {
    const session = await requireAnyPermission(
      "manage_inventory",
      "edit_pages",
      "manage_roles"
    );
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      {
        products: await listProducts({ includeInactive: true }),
        persist: storePersistStatus(),
      },
      { headers: noStore }
    );
  }
  const products = await listProducts();
  return NextResponse.json(
    { products, updatedAt: new Date().toISOString() },
    { headers: noStore }
  );
}

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.union([z.string(), z.null()]).optional().transform((v) => v || ""),
  price: z.coerce.number().min(0).default(0),
  stock: z.coerce.number().int().min(0).default(0),
  category: z.string().default("Accessories"),
  brand: z.string().default("Ballard's Bowling"),
  image: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v && String(v).trim() ? String(v).trim() : "/images/logo.png")),
  featured: z.coerce.boolean().optional(),
  active: z.coerce.boolean().optional(),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  shopifyVariantId: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await requireAnyPermission("manage_inventory", "edit_pages");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized — log in as admin" }, { status: 401 });
  }
  try {
    const raw = await req.json();
    const body = createSchema.parse(raw);
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
      discountPercent: body.discountPercent,
      stock: body.stock,
      category: body.category,
      brand: body.brand,
      image: body.image,
      featured: body.featured ?? false,
      active: body.active ?? true,
      shopifyVariantId: body.shopifyVariantId,
    });
    const products = await listProducts({ includeInactive: true });
    const persist = storePersistStatus();
    return NextResponse.json(
      {
        product,
        products,
        persist,
        warning: persist.githubWriteConfigured
          ? undefined
          : "Saved. Add GITHUB_TOKEN in Vercel so every visitor sees shop updates (or refresh shop on this same browser).",
      },
      { status: 201, headers: noStore }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
