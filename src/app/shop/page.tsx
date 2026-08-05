import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { EditablePageTitle } from "@/components/EditablePageTitle";
import { EditableProductGrid } from "@/components/EditableProductGrid";
import { InStoreVisitCard } from "@/components/InStoreVisitCard";
import { brandImage, FEATURED_BRANDS } from "@/lib/shop-nav";
import { getText, listProducts } from "@/lib/store";

export const dynamic = "force-dynamic";

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

  const brand = params.brand?.trim() || "";
  const category = params.category?.trim() || "";
  const q = params.q?.trim() || "";

  const filters = {
    brand: brand || undefined,
    category: category || undefined,
    q: q || undefined,
  };

  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const brandCounts = new Map<string, number>();
  for (const p of products) {
    if (!p.active || !p.brand) continue;
    brandCounts.set(p.brand, (brandCounts.get(p.brand) || 0) + 1);
  }

  // Featured brands first (even if 0), then any other brands with stock.
  const brandTiles: { name: string; count: number; href: string; image: string }[] =
    [];
  const seen = new Set<string>();
  for (const name of FEATURED_BRANDS) {
    const hit = [...brandCounts.keys()].find(
      (b) => b.toLowerCase() === name.toLowerCase()
    );
    const display = hit || name;
    brandTiles.push({
      name: display,
      count: hit ? brandCounts.get(hit) || 0 : 0,
      href: `/shop?brand=${encodeURIComponent(display)}#inventory`,
      image: brandImage(display),
    });
    seen.add(display.toLowerCase());
  }
  for (const [name, count] of [...brandCounts.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    if (seen.has(name.toLowerCase())) continue;
    // Skip generic house accessories brand from the main brand tiles
    if (name.toLowerCase().includes("ballard")) continue;
    brandTiles.push({
      name,
      count,
      href: `/shop?brand=${encodeURIComponent(name)}#inventory`,
      image: brandImage(name),
    });
  }

  const activeFilterLabel = brand
    ? brand
    : category
      ? category
      : q
        ? `“${q}”`
        : "";

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

        <div className="mb-8">
          <p className="text-xs tracking-[0.2em] text-red uppercase">
            Shop by brand
          </p>
          <p className="mt-1 text-sm text-mist">
            Tap a brand to see every ball and item from that line.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {brandTiles.map((b) => {
              const active =
                brand && brand.toLowerCase() === b.name.toLowerCase();
              return (
                <Link
                  key={b.name}
                  href={b.href}
                  className={`group relative min-h-[130px] overflow-hidden rounded-2xl border transition ${
                    active
                      ? "border-red ring-2 ring-red/40"
                      : "border-white/10 hover:border-red/50"
                  }`}
                >
                  <Image
                    src={b.image}
                    alt={b.name}
                    fill
                    className="object-cover opacity-70 transition group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/55" />
                  <span className="absolute inset-x-0 bottom-0 p-3">
                    <span className="block text-sm font-semibold text-chalk">
                      {b.name}
                    </span>
                    <span className="block text-xs text-mist">
                      {b.count} item{b.count === 1 ? "" : "s"}
                    </span>
                  </span>
                </Link>
              );
            })}
            <Link
              href="/coaching"
              className="group relative min-h-[130px] overflow-hidden rounded-2xl border border-white/10 hover:border-red/50"
            >
              <Image
                src="/images/collections/bowling-lessons.png"
                alt="Lessons"
                fill
                className="object-cover opacity-70 transition group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/55" />
              <span className="absolute inset-x-0 bottom-0 p-3 text-sm font-semibold">
                Lessons
              </span>
            </Link>
          </div>
        </div>

        <div className="mb-8">
          <p className="text-xs tracking-[0.2em] text-red uppercase">
            Shop by category
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/shop#inventory"
              className={`rounded-full border px-4 py-2 text-sm transition ${
                !category && !brand
                  ? "border-red bg-red text-white"
                  : "border-white/15 text-mist hover:border-red/50 hover:text-chalk"
              }`}
            >
              All
            </Link>
            {categories.map((c) => {
              const active = category.toLowerCase() === c.toLowerCase();
              return (
                <Link
                  key={c}
                  href={`/shop?category=${encodeURIComponent(c)}#inventory`}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    active
                      ? "border-red bg-red text-white"
                      : "border-white/15 text-mist hover:border-red/50 hover:text-chalk"
                  }`}
                >
                  {c}
                </Link>
              );
            })}
          </div>
        </div>

        <form
          id="inventory"
          className="mb-6 flex flex-wrap gap-3 scroll-mt-28"
        >
          <input
            name="q"
            defaultValue={q}
            placeholder="Search inventory..."
            className="field max-w-sm"
          />
          <select
            name="category"
            defaultValue={category}
            className="field max-w-[200px]"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            name="brand"
            defaultValue={brand}
            className="field max-w-[200px]"
          >
            <option value="">All brands</option>
            {[...brandCounts.keys()]
              .sort((a, b) => a.localeCompare(b))
              .map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
          </select>
          <button className="btn btn-primary" type="submit">
            Filter
          </button>
          {(brand || q || category) && (
            <Link href="/shop#inventory" className="btn btn-ghost">
              Clear
            </Link>
          )}
        </form>

        {activeFilterLabel ? (
          <p className="mb-4 text-sm text-mist">
            Showing{" "}
            <span className="text-red">{activeFilterLabel}</span>
            {brand ? " — tap Clear or All to see every brand" : ""}
          </p>
        ) : null}

        <EditableProductGrid initial={products} filters={filters} />
      </section>
    </>
  );
}
