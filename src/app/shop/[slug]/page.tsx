import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/store";
import { AddToCartButton } from "@/components/AddToCartButton";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product || !product.active) notFound();

  return (
    <section className="site-shell section-pad pt-24">
      <Link href="/shop" className="text-sm text-mist underline decoration-amber/40">
        ← Back to shop
      </Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-white/10 bg-black/30">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-contain p-8"
            priority
          />
        </div>
        <div>
          <p className="text-sm tracking-[0.18em] text-amber uppercase">{product.brand}</p>
          <h1 className="display mt-2 text-5xl md:text-6xl">{product.name}</h1>
          <p className="mt-4 text-2xl text-chalk">${product.price.toFixed(2)}</p>
          <p className="mt-2 text-sm text-mist">
            {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"} · {product.category}
          </p>
          <p className="mt-6 leading-relaxed text-mist">{product.description}</p>
          <div className="mt-8">
            <AddToCartButton productId={product.id} disabled={product.stock <= 0} />
          </div>
        </div>
      </div>
    </section>
  );
}
