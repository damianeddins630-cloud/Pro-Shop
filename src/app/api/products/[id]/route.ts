import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import {
  deleteProduct,
  getProduct,
  storePersistStatus,
  updateProduct,
} from "@/lib/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ product });
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.coerce.number().nonnegative().optional(),
  stock: z.coerce.number().int().nonnegative().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  image: z.string().min(1).optional(),
  featured: z.boolean().optional(),
  active: z.boolean().optional(),
  shopifyVariantId: z.string().optional(),
});

export async function PUT(req: Request, { params }: Params) {
  const session = await requireAnyPermission("manage_inventory", "edit_pages");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized — log in as admin" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = patchSchema.parse(await req.json());
    const product = await updateProduct(id, body);
    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ product, persist: storePersistStatus() });
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
  return NextResponse.json({ ok: true, persist: storePersistStatus() });
}
