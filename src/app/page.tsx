import Image from "next/image";
import Link from "next/link";
import { HeroSlider } from "@/components/HeroSlider";
import { listDeals, listProducts } from "@/lib/store";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HomePage() {
  let products: Awaited<ReturnType<typeof listProducts>> = [];
  let deals: Awaited<ReturnType<typeof listDeals>> = [];
  try {
    [products, deals] = await Promise.all([listProducts(), listDeals()]);
  } catch {
    products = [];
    deals = [];
  }
  const featured = products.filter((p) => p.featured).slice(0, 4);
  const deal = deals.find((d) => d.featured && d.active) || deals.find((d) => d.active);

  return (
    <>
      <HeroSlider />

      <section className="site-shell section-pad">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm tracking-[0.2em] text-red uppercase">Training</p>
            <h2 className="display text-4xl md:text-5xl">Bowling Lessons</h2>
          </div>
          <Link href="/coaching" className="text-sm text-mist underline decoration-red/40">
            View all
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Link
            href="/coaching"
            className="group relative min-h-[280px] overflow-hidden rounded-3xl"
          >
            <Image
              src="/images/collections/bowling-lessons.png"
              alt="Bowling Lessons"
              fill
              className="object-cover transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
            <div className="absolute bottom-0 p-6">
              <h3 className="display text-3xl">Bowling Lessons</h3>
              <p className="mt-1 text-sm text-mist">Private coaching to perfect your game</p>
            </div>
          </Link>
          <Link
            href="/coaching"
            className="group relative min-h-[280px] overflow-hidden rounded-3xl"
          >
            <Image
              src="/images/collections/clinics.jpg"
              alt="Coaching Clinics"
              fill
              className="object-cover transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
            <div className="absolute bottom-0 p-6">
              <h3 className="display text-3xl">Coaching Clinics / Group Lessons</h3>
              <p className="mt-1 text-sm text-mist">Bring Ballard&apos;s Academy to your center</p>
            </div>
          </Link>
        </div>
      </section>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/hero/slide-2.jpg"
            alt=""
            fill
            className="object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-black/85" />
        </div>
        <div className="site-shell section-pad relative">
          <p className="text-sm tracking-[0.22em] text-red uppercase">Our Story</p>
          <h2 className="display mt-2 max-w-3xl text-4xl md:text-6xl">
            Elite Coaching. Family. Passion.
          </h2>
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div className="space-y-4 text-mist leading-relaxed">
              <p>
                <strong className="text-chalk">Mission</strong> – To provide world-class coaching
                that will enhance the bowling experience to all bowlers and coaches while growing
                the sport of bowling at all levels on and off the lanes.
              </p>
              <p>
                <strong className="text-chalk">Vision</strong> – To strengthen the bowling community
                through Education and Coaching.
              </p>
            </div>
            <p className="text-mist leading-relaxed">
              Ballard&apos;s Bowling Academy was created from the love and passion for the sport of
              bowling. We believe there is a true inner Champion in all of us whether on the lanes
              or behind the scenes. There are many facets that lead to success and we look to help
              you develop a plan to achieve your personal goals. At Ballard&apos;s Bowling Academy
              we look to inspire you to reach your bowling goals as well as use the tools learned
              to achieve off-lane success as well.
            </p>
          </div>
        </div>
      </section>

      {deal && (
        <section className="site-shell section-pad">
          <div className="grid items-center gap-8 overflow-hidden rounded-[2rem] border border-red/30 bg-gradient-to-br from-lane/80 to-ink lg:grid-cols-2">
            <div className="relative min-h-[320px]">
              <Image src={deal.image} alt={deal.title} fill className="object-cover" />
            </div>
            <div className="p-8 md:p-10">
              <p className="text-sm tracking-[0.2em] text-red uppercase">Deal of the Month</p>
              <h2 className="display mt-2 text-4xl md:text-5xl">{deal.title}</h2>
              <p className="mt-4 text-mist">{deal.description}</p>
              <Link href="/deals" className="btn btn-primary mt-6">
                See deals & specials
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="site-shell section-pad pt-0">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm tracking-[0.2em] text-red uppercase">Pro Shop</p>
            <h2 className="display text-4xl md:text-5xl">Featured Gear</h2>
          </div>
          <Link href="/shop" className="text-sm text-mist underline decoration-red/40">
            Shop all
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </>
  );
}
