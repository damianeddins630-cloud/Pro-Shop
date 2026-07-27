import Image from "next/image";
import Link from "next/link";
import { EditableCoaches } from "@/components/EditableCoaches";
import { EditablePageTitle } from "@/components/EditablePageTitle";
import { getText, listCoaches } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CoachingPage() {
  const [
    coaches,
    eyebrow,
    title,
    intro,
    requestTitle,
    body1,
    body2,
    requestCta,
    shopCta,
    videoCaption,
    coachesTitle,
  ] = await Promise.all([
    listCoaches(),
    getText("coaching", "eyebrow", "Coaching"),
    getText("coaching", "title", "Coaching Clinics / Group Lessons"),
    getText(
      "coaching",
      "intro",
      "Bring Ballard's Bowling Academy to you — quality coaching and seminars for bowlers and coaches."
    ),
    getText("coaching", "request_title", "Request a Clinic"),
    getText(
      "coaching",
      "body1",
      "Ballard's Bowling Academy offers quality coaching and seminars to bowlers and coaches to help enhance the bowling and coaching experience."
    ),
    getText(
      "coaching",
      "body2",
      "Please reach out to us via email — Contactus@ballardsbowlingacdemy.com"
    ),
    getText("coaching", "request_cta", "Request a Clinic"),
    getText("coaching", "shop_cta", "Shop pro shop gear"),
    getText("coaching", "video_caption", "Watch Ballard's Academy in action."),
    getText("coaching", "coaches_title", "Our Coaches"),
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
          <EditablePageTitle
            page="coaching"
            slot="eyebrow"
            initial={eyebrow}
            as="p"
            className="text-sm tracking-[0.22em] text-red uppercase"
          />
          <EditablePageTitle
            page="coaching"
            slot="title"
            initial={title}
            as="h1"
            className="display mt-2 max-w-3xl text-5xl md:text-7xl"
          />
          <EditablePageTitle
            page="coaching"
            slot="intro"
            initial={intro}
            as="p"
            multiline
            rows={3}
            className="mt-4 max-w-2xl text-mist"
          />
        </div>
      </section>

      <section className="site-shell section-pad grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <EditablePageTitle
            page="coaching"
            slot="request_title"
            initial={requestTitle}
            as="h2"
            className="display text-4xl"
          />
          <EditablePageTitle
            page="coaching"
            slot="body1"
            initial={body1}
            as="p"
            multiline
            rows={4}
            className="mt-4 leading-relaxed text-mist"
          />
          <EditablePageTitle
            page="coaching"
            slot="body2"
            initial={body2}
            as="p"
            multiline
            rows={3}
            className="mt-4 leading-relaxed text-mist"
          />
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="mailto:Contactus@ballardsbowlingacdemy.com?subject=Clinic%20Request"
              className="btn btn-primary"
            >
              <EditablePageTitle
                page="coaching"
                slot="request_cta"
                initial={requestCta}
                as="span"
                className="inline"
              />
            </a>
            <Link href="/shop" className="btn btn-ghost">
              <EditablePageTitle
                page="coaching"
                slot="shop_cta"
                initial={shopCta}
                as="span"
                className="inline"
              />
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
          <div className="p-5 text-sm text-mist">
            <EditablePageTitle
              page="coaching"
              slot="video_caption"
              initial={videoCaption}
              as="p"
              className="text-sm text-mist"
            />
          </div>
        </div>
      </section>

      <section className="site-shell section-pad pt-0">
        <EditablePageTitle
          page="coaching"
          slot="coaches_title"
          initial={coachesTitle}
          as="h2"
          className="display mb-6 text-4xl"
        />
        <EditableCoaches initial={coaches} />
      </section>
    </>
  );
}
