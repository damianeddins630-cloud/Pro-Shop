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
  deleteProduct,
  getInventoryUpdatedAt,
  getProduct,
  listProducts,
  storePersistStatus,
  updateProduct,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

type Params = { params: Promise<{ id: string }> };

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

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ product }, { headers: noStore });
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  image: z.string().min(1).optional(),
  featured: z.coerce.boolean().optional(),
  active: z.coerce.boolean().optional(),
  discountPercent: z.coerce.number().min(0).max(100).optional(),
  shopifyVariantId: z.string().optional(),
  weightOptions: z
    .array(z.coerce.number().positive().max(30))
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null) return undefined;
      const cleaned = [
        ...new Set(v.map((n) => Math.round(n * 10) / 10)),
      ].sort((a, b) => a - b);
      return cleaned;
    }),
});

export async function PUT(req: Request, { params }: Params) {
  const session = await requireAnyPermission("manage_inventory", "edit_pages");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized — log in as admin" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = patchSchema.parse(await req.json());
    const before = await getProduct(id);
    const product = await updateProduct(id, body);
    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!requireDurablePersistOrLocal()) {
      return persistFailedResponse("Product update");
    }

    const catalogChanged =
      before &&
      (body.price !== undefined ||
        body.discountPercent !== undefined ||
        body.stock !== undefined ||
        body.active !== undefined ||
        body.weightOptions !== undefined);
    const voided = catalogChanged ? await voidStaleShopifyInvoices() : 0;

    const products = await listProducts({ includeInactive: true });
    return NextResponse.json(
      withPersistMeta({
        product,
        products,
        updatedAt: await getInventoryUpdatedAt(),
        voidedUnpaidCheckouts: voided,
        message:
          "Price/discount/stock saved durably. Shopify will charge these website amounts on the next Pay click.",
      }),
      { headers: noStore }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireAnyPermission("manage_inventory", "edit_pages");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized — log in as admin" }, { status: 401 });
  }
  const { id } = await params;
  const ok = await deleteProduct(id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!requireDurablePersistOrLocal()) {
    return persistFailedResponse("Product delete");
  }
  await voidStaleShopifyInvoices();
  const products = await listProducts({ includeInactive: true });
  return NextResponse.json(
    withPersistMeta({
      ok: true,
      products,
      updatedAt: await getInventoryUpdatedAt(),
      persist: storePersistStatus(),
    }),
    { headers: noStore }
  );
}
