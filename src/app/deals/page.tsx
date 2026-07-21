import Image from "next/image";
import { listDeals } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const deals = (await listDeals()).filter((d) => d.active);

  return (
    <>
      <section className="site-shell section-pad pt-24">
        <p className="text-sm tracking-[0.22em] text-red uppercase">Specials</p>
        <h1 className="display mt-2 text-5xl md:text-7xl">Deals and Specials</h1>
        <p className="mt-4 max-w-2xl text-mist">
          Deal of the month and seasonal offers from Ballard&apos;s Bowling Academy Pro Shop.
        </p>
      </section>

      <section className="site-shell pb-20 grid gap-8">
        {deals.map((deal) => (
          <article
            key={deal.id}
            className="grid overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] lg:grid-cols-2"
          >
            <div className="relative min-h-[320px]">
              <Image src={deal.image} alt={deal.title} fill className="object-cover" />
            </div>
            <div className="flex flex-col justify-center p-8 md:p-10">
              {deal.featured && (
                <span className="mb-3 w-fit rounded-full bg-red/15 px-3 py-1 text-xs tracking-[0.16em] text-red uppercase">
                  Deal of the Month
                </span>
              )}
              <h2 className="display text-4xl">{deal.title}</h2>
              <p className="mt-4 text-mist">{deal.description}</p>
            </div>
          </article>
        ))}
        {deals.length === 0 && <p className="text-mist">No active deals right now — check back soon.</p>}
      </section>
    </>
  );
}
