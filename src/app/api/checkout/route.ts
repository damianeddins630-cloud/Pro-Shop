import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createOrder, getProduct, reduceStock } from "@/lib/store";

const schema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Please log in to checkout" }, { status: 401 });
  }
  try {
    const body = schema.parse(await req.json());
    const lineItems = [];
    let total = 0;

    for (const item of body.items) {
      const product = await getProduct(item.productId);
      if (!product || !product.active) {
        return NextResponse.json({ error: "Product unavailable" }, { status: 400 });
      }
      if (product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Not enough stock for ${product.name}` },
          { status: 400 }
        );
      }
      lineItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        image: product.image,
      });
      total += product.price * item.quantity;
    }

    await reduceStock(body.items);
    const order = await createOrder({
      userId: session.userId,
      username: session.username,
      email: session.email,
      items: lineItems,
      total,
    });

    return NextResponse.json({
      ok: true,
      order,
      message: "Order placed — saved to your previous orders.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
