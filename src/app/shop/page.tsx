import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { EditablePageTitle } from "@/components/EditablePageTitle";
import { EditableProductGrid } from "@/components/EditableProductGrid";
import { InStoreVisitCard } from "@/components/InStoreVisitCard";
import { getText, listProducts } from "@/lib/store";

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
  const [products, eyebrow, title, intro] = await Promise.all([
    listProducts(),
    getText("shop", "eyebrow", "Pro Shop"),
    getText("shop", "title", "Inventory & Gear"),
    getText(
      "shop",
      "intro",
      "Buy online, then come in for drilling and pickup. In-store only — no shipping. Live inventory from Ballard's pro shop."
    ),
  ]);
  const filters = {
    brand: params.brand,
    category: params.category,
    q: params.q,
  };
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
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 to-black" />
        <div className="site-shell relative z-10 py-16 pt-24">
          <div className="flex items-center gap-4">
            <BrandMark mode="cart" size={72} />
            <div>
              <EditablePageTitle
                page="shop"
                slot="eyebrow"
                initial={eyebrow}
                as="p"
                className="text-sm tracking-[0.22em] text-red uppercase"
              />
              <EditablePageTitle
                page="shop"
                slot="title"
                initial={title}
                as="h1"
                className="display text-5xl md:text-7xl"
              />
            </div>
          </div>
          <EditablePageTitle
            page="shop"
            slot="intro"
            initial={intro}
            as="p"
            multiline
            rows={3}
            className="mt-4 max-w-2xl text-mist"
          />
        </div>
      </section>

      <section className="site-shell section-pad">
        <div className="mb-8">
          <InStoreVisitCard />
        </div>
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {brands.map((b) => (
            <Link
              key={b.name}
              href={b.href}
              className="group relative min-h-[120px] overflow-hidden rounded-2xl border border-white/10"
            >
              <Image
                src={b.image}
                alt={b.name}
                fill
                className="object-cover opacity-70 transition group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/55" />
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
          <select
            name="category"
            defaultValue={params.category || ""}
            className="field max-w-[200px]"
          >
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
            Showing brand: <span className="text-red">{params.brand}</span>
          </p>
        )}

        <EditableProductGrid initial={[]} filters={filters} />
      </section>
    </>
  );
}
