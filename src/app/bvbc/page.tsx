import Image from "next/image";
import { EditablePageTitle } from "@/components/EditablePageTitle";
import { EditableSponsors } from "@/components/EditableSponsors";
import { getText, listSponsors } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function BvbcPage() {
  const [
    sponsors,
    eyebrow,
    title,
    intro,
    historyTitle,
    names,
    p1,
    p2,
    p3,
    p4,
    p5,
    quote,
    attribution,
    whereTitle,
    whereBody,
    teamCta,
    sponsorCta,
    thanksTitle,
    thanksIntro,
  ] = await Promise.all([
    listSponsors(),
    getText("bvbc", "eyebrow", "Charity"),
    getText("bvbc", "title", 'Ballard vs. The Big "C"'),
    getText(
      "bvbc",
      "intro",
      "Striking Back to Spare More Lives — supporting cancer patients and caregivers through the sport of bowling."
    ),
    getText("bvbc", "history_title", "Brief History"),
    getText("bvbc", "names", "Del Ballard, Jr. and Carolyn Dorin-Ballard"),
    getText(
      "bvbc",
      "p1",
      "Born into the environment of bowling, since the parents of both Del and Carolyn were avid bowlers, they were destined to use their talents in many ways."
    ),
    getText(
      "bvbc",
      "p2",
      "At 18 years of age, Del joined the PBA and earned 13 titles which included four major championships of which two were U.S. Open titles. He is ranked 29th among the greatest of all time and is currently one of the top national and international bowling coaches in the world. This 2009 USBC Hall of Famer is currently the Storm/Roto Grip PBA Tour rep as well as an international coach for Team Hong Kong."
    ),
    getText(
      "bvbc",
      "p3",
      "At 25, Carolyn joined the LPBT tour (later PWBA) and won 20 national championships, including three majors in her career. She also captured two USBC/PBA Women's World Series titles as well as the World Tour Championship in 2011. This 2008 USBC Hall of Famer admits she was never the most talented, but credits hard work and determination for her success."
    ),
    getText(
      "bvbc",
      "p4",
      "Off the lanes, Del and Carolyn are the owners of Ballard's Bowling Academy and Ballard's Bowling Academy Pro Shops — however, they both agree their greatest accomplishment is their daughter, Alyssa."
    ),
    getText(
      "bvbc",
      "p5",
      'The current passion for the Ballard family is their charity event: Ballard vs. The Big "C" Striking Back to Spare More Lives. The idea for the event took root after Del was diagnosed with tonsil cancer in 2010 which changed their lives forever. Over the years this event has contributed hundreds of thousands of dollars to support Baylor Scott & White, North Texas Laryngectomy Society, and Cancer Care Services.'
    ),
    getText(
      "bvbc",
      "quote",
      '"This is what we are supposed to do – help others who may not be able to help themselves as well as give back to our community through our sport."'
    ),
    getText("bvbc", "attribution", "— Del and Carolyn Ballard"),
    getText("bvbc", "where_title", "Where the $ Goes"),
    getText(
      "bvbc",
      "where_body",
      "With generous donations from our sponsors and supporters like you, we provide support to Baylor Scott & White, Cancer Care Services of Fort Worth, and The North Texas Laryngectomy Society. Together we have provided over $700,000 in support and contributions for these organizations."
    ),
    getText("bvbc", "team_cta", "Team Entry Form"),
    getText("bvbc", "sponsor_cta", "Sponsorship Info"),
    getText("bvbc", "thanks_title", "Thank You To All Of Our Sponsors!"),
    getText(
      "bvbc",
      "thanks_intro",
      'These partners help fuel Ballard\'s Bowling Academy and Ballard vs. The Big "C".'
    ),
  ]);

  return (
    <>
      <section className="site-shell section-pad pt-24">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
          <div className="relative h-24 w-56 shrink-0 md:h-28 md:w-72">
            <Image
              src="/images/bvbc-logo.png"
              alt='Ballard vs. The Big "C"'
              fill
              className="img-clean"
              priority
              sizes="288px"
              unoptimized
            />
          </div>
          <div>
            <EditablePageTitle
              page="bvbc"
              slot="eyebrow"
              initial={eyebrow}
              as="p"
              className="text-sm tracking-[0.22em] text-red uppercase"
            />
            <EditablePageTitle
              page="bvbc"
              slot="title"
              initial={title}
              as="h1"
              className="display mt-1 text-4xl md:text-6xl"
            />
            <EditablePageTitle
              page="bvbc"
              slot="intro"
              initial={intro}
              as="p"
              multiline
              rows={3}
              className="mt-3 max-w-2xl text-mist"
            />
          </div>
        </div>
      </section>

      <section className="site-shell section-pad grid gap-10 pt-0 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5 leading-relaxed text-mist">
          <EditablePageTitle
            page="bvbc"
            slot="history_title"
            initial={historyTitle}
            as="h2"
            className="display text-4xl text-chalk"
          />
          <EditablePageTitle
            page="bvbc"
            slot="names"
            initial={names}
            as="h3"
            className="text-xl font-semibold text-chalk"
          />
          {[
            ["p1", p1],
            ["p2", p2],
            ["p3", p3],
            ["p4", p4],
            ["p5", p5],
          ].map(([slot, text]) => (
            <EditablePageTitle
              key={slot}
              page="bvbc"
              slot={slot}
              initial={text}
              as="p"
              multiline
              rows={5}
              className="leading-relaxed text-mist"
            />
          ))}
          <EditablePageTitle
            page="bvbc"
            slot="quote"
            initial={quote}
            as="p"
            multiline
            rows={3}
            className="text-chalk italic"
          />
          <EditablePageTitle
            page="bvbc"
            slot="attribution"
            initial={attribution}
            as="p"
            className="text-mist"
          />
        </div>

        <div className="space-y-5">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-transparent p-4">
            <Image
              src="/images/bvbc-flyer.png"
              alt="BVBC Flyer 2026"
              width={900}
              height={1200}
              className="img-clean h-auto w-full"
              unoptimized
            />
          </div>
          <div className="rounded-3xl border border-red/25 bg-lane/40 p-6">
            <EditablePageTitle
              page="bvbc"
              slot="where_title"
              initial={whereTitle}
              as="h3"
              className="display text-3xl"
            />
            <EditablePageTitle
              page="bvbc"
              slot="where_body"
              initial={whereBody}
              as="p"
              multiline
              rows={6}
              className="mt-3 text-sm leading-relaxed text-mist"
            />
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                className="btn btn-primary !text-sm"
                href="mailto:Contactus@ballardsbowlingacdemy.com?subject=BVBC%20Team%20Entry"
              >
                <EditablePageTitle
                  page="bvbc"
                  slot="team_cta"
                  initial={teamCta}
                  as="span"
                  className="inline"
                />
              </a>
              <a
                className="btn btn-ghost !text-sm"
                href="mailto:Contactus@ballardsbowlingacdemy.com?subject=BVBC%20Sponsorship"
              >
                <EditablePageTitle
                  page="bvbc"
                  slot="sponsor_cta"
                  initial={sponsorCta}
                  as="span"
                  className="inline"
                />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="sponsors" className="site-shell section-pad scroll-mt-24">
        <EditablePageTitle
          page="bvbc"
          slot="thanks_title"
          initial={thanksTitle}
          as="h2"
          className="display text-4xl md:text-5xl"
        />
        <EditablePageTitle
          page="bvbc"
          slot="thanks_intro"
          initial={thanksIntro}
          as="p"
          multiline
          rows={2}
          className="mt-3 max-w-2xl text-mist"
        />
        <EditableSponsors initial={sponsors} />
      </section>
    </>
  );
}
