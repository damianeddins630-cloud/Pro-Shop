import Image from "next/image";
import { listSponsors } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SponsorsPage() {
  const sponsors = await listSponsors();

  return (
    <section className="site-shell section-pad pt-24">
      <p className="text-sm tracking-[0.22em] text-amber uppercase">Partners</p>
      <h1 className="display mt-2 text-5xl md:text-7xl">
        Thank You To All Of Our Sponsors!
      </h1>
      <p className="mt-4 max-w-2xl text-mist">
        These partners help fuel Ballard&apos;s Bowling Academy and Ballard vs. The Big &quot;C&quot;.
      </p>

      <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {sponsors.map((sponsor) => (
          <a
            key={sponsor.id}
            href={sponsor.url || "#"}
            target={sponsor.url?.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            className="group flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-amber/40"
          >
            <div className="relative mb-4 h-28 w-full">
              <Image
                src={sponsor.image}
                alt={sponsor.name}
                fill
                className="object-contain"
              />
            </div>
            <span className="text-center text-sm font-semibold text-chalk group-hover:text-amber">
              {sponsor.name}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
