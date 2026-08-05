import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import {
  persistFailedResponse,
  requireDurablePersistOrLocal,
  withPersistMeta,
} from "@/lib/persist-guard";
import { deleteShopifyDraftOrder } from "@/lib/shopify";
import {
  cancelAllOpenShopifyCheckouts,
  createProduct,
  getInventoryUpdatedAt,
  listProducts,
  storePersistStatus,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

async function voidStaleShopifyInvoices() {
  try {
    const cancelled = await cancelAllOpenShopifyCheckouts();
    await Promise.all(
      cancelled.map((o) => deleteShopifyDraftOrder(o.shopifyDraftOrderId))
    );
    return cancelled.length;
  } catch {
    return 0;
  }
}

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
        updatedAt: await getInventoryUpdatedAt(),
        persist: storePersistStatus(),
      },
      { headers: noStore }
    );
  }
  const products = await listProducts();
  return NextResponse.json(
    {
      products,
      updatedAt: await getInventoryUpdatedAt(),
    },
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
  weightOptions: z
    .array(z.coerce.number().positive().max(30))
    .optional()
    .nullable()
    .transform((v) => {
      if (!v) return undefined;
      const cleaned = [
        ...new Set(v.map((n) => Math.round(n * 10) / 10)),
      ].sort((a, b) => a - b);
      return cleaned.length ? cleaned : undefined;
    }),
  weightStock: z.record(z.string(), z.coerce.number().int().min(0)).optional().nullable(),
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
      weightOptions: body.weightOptions,
      weightStock: body.weightStock || undefined,
    });

    if (!requireDurablePersistOrLocal()) {
      return persistFailedResponse("Product create");
    }

    const voided = await voidStaleShopifyInvoices();
    const products = await listProducts({ includeInactive: true });
    return NextResponse.json(
      withPersistMeta({
        product,
        products,
        updatedAt: await getInventoryUpdatedAt(),
        voidedUnpaidCheckouts: voided,
        message: "Product saved durably — live for every shopper.",
      }),
      { status: 201, headers: noStore }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
