import Image from "next/image";
import Link from "next/link";
import { EditableCoaches } from "@/components/EditableCoaches";
import { EditablePageTitle } from "@/components/EditablePageTitle";
import { getText, listCoaches } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CoachingPage() {
  const [coaches, title] = await Promise.all([
    listCoaches(),
    getText("coaching", "title", "Coaching Clinics / Group Lessons"),
  ]);

  return (
    <>
      <section className="relative min-h-[55vh] overflow-hidden">
        <Image
          src="/images/hero/slide-1.jpg"
          alt=""
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/30" />
        <div className="site-shell relative z-10 flex min-h-[55vh] flex-col justify-end pb-14 pt-28">
          <p className="text-sm tracking-[0.22em] text-red uppercase">Coaching</p>
          <EditablePageTitle
            page="coaching"
            slot="title"
            initial={title}
            as="h1"
            className="display mt-2 max-w-3xl text-5xl md:text-7xl"
          />
          <p className="mt-4 max-w-2xl text-mist">
            Bring Ballard&apos;s Bowling Academy to you — quality coaching and seminars for
            bowlers and coaches.
          </p>
        </div>
      </section>

      <section className="site-shell section-pad grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h2 className="display text-4xl">Request a Clinic</h2>
          <p className="mt-4 leading-relaxed text-mist">
            Ballard&apos;s Bowling Academy offers quality coaching and seminars to bowlers and
            coaches to help enhance the bowling and coaching experience.
          </p>
          <p className="mt-4 leading-relaxed text-mist">
            Please reach out to us via email —{" "}
            <a
              className="text-red underline"
              href="mailto:Contactus@ballardsbowlingacdemy.com"
            >
              Contactus@ballardsbowlingacdemy.com
            </a>
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="mailto:Contactus@ballardsbowlingacdemy.com?subject=Clinic%20Request"
              className="btn btn-primary"
            >
              Request a Clinic
            </a>
            <Link href="/shop" className="btn btn-ghost">
              Shop pro shop gear
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/30">
          <div className="aspect-video">
            <iframe
              className="h-full w-full"
              src="https://www.youtube.com/embed/DShYVT72z1Y"
              title="Ballard's Bowling Academy coaching"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="p-5 text-sm text-mist">Watch Ballard&apos;s Academy in action.</div>
        </div>
      </section>

      <section className="site-shell section-pad pt-0">
        <h2 className="display mb-6 text-4xl">Our Coaches</h2>
        <EditableCoaches initial={coaches} />
      </section>
    </>
  );
}
