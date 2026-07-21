import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { ProductCard } from "@/components/ProductCard";
import { listProducts } from "@/lib/store";

export const dynamic = "force-dynamic";

const brands = [
  { name: "900 Global", href: "/shop?brand=900%20Global", image: "/images/brands/900-global.png" },
  { name: "Storm", href: "/shop?brand=Storm", image: "/images/brands/storm.jpg" },
  { name: "Roto Grip", href: "/shop?brand=Roto%20Grip", image: "/images/brands/roto-grip.jpg" },
  { name: "Lessons", href: "/coaching", image: "/images/collections/bowling-lessons.png" },
];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const products = await listProducts();
  const filtered = products.filter((p) => {
    if (params.brand && p.brand !== params.brand) return false;
    if (params.category && p.category !== params.category) return false;
    if (params.q) {
      const q = params.q.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const categories = Array.from(new Set(products.map((p) => p.category))).sort();

  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10">
        <Image
          src="/images/hero/slide-3.jpg"
          alt=""
          fill
          className="object-cover opacity-40"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/70 to-ink" />
        <div className="site-shell relative z-10 py-16 pt-24">
          <div className="flex items-center gap-4">
            <BrandMark mode="cart" size={72} />
            <div>
              <p className="text-sm tracking-[0.22em] text-amber uppercase">Pro Shop</p>
              <h1 className="display text-5xl md:text-7xl">Inventory & Gear</h1>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-mist">
            Real products from Ballard&apos;s Bowling Academy — balls, bags, Turbo accessories,
            and coaching services. Inventory is live and admin-managed.
          </p>
        </div>
      </section>

      <section className="site-shell section-pad">
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {brands.map((b) => (
            <Link
              key={b.name}
              href={b.href}
              className="group relative min-h-[120px] overflow-hidden rounded-2xl border border-white/10"
            >
              <Image src={b.image} alt={b.name} fill className="object-cover opacity-70 transition group-hover:scale-105" />
              <div className="absolute inset-0 bg-ink/55" />
              <span className="absolute inset-x-0 bottom-0 p-3 text-sm font-semibold">{b.name}</span>
            </Link>
          ))}
        </div>

        <form className="mb-6 flex flex-wrap gap-3">
          <input
            name="q"
            defaultValue={params.q || ""}
            placeholder="Search inventory..."
            className="field max-w-sm"
          />
          <select name="category" defaultValue={params.category || ""} className="field max-w-[200px]">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {params.brand && <input type="hidden" name="brand" value={params.brand} />}
          <button className="btn btn-primary" type="submit">
            Filter
          </button>
          {(params.brand || params.q || params.category) && (
            <Link href="/shop" className="btn btn-ghost">
              Clear
            </Link>
          )}
        </form>

        {params.brand && (
          <p className="mb-4 text-sm text-mist">
            Showing brand: <span className="text-amber">{params.brand}</span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="mt-8 text-mist">No products match that filter.</p>
        )}
      </section>
    </>
  );
}
