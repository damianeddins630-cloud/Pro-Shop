import Image from "next/image";
import Link from "next/link";
import { HeroSlider } from "@/components/HeroSlider";
import { EditablePageTitle } from "@/components/EditablePageTitle";
import { EditableProductGrid } from "@/components/EditableProductGrid";
import { getText, listDeals } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HomePage() {
  let deals: Awaited<ReturnType<typeof listDeals>> = [];
  const defaults = {
    hero: "Perfect Your Game",
    heroSub: "Hall of Fame coaching and a state-of-the-art pro shop.",
    heroCta1: "Book a Lesson →",
    heroCta2: "Shop gear →",
    trainingEyebrow: "Training",
    training: "Bowling Lessons",
    trainingLink: "View all",
    lessonTitle: "Bowling Lessons",
    lessonSub: "Private coaching to perfect your game",
    clinicTitle: "Coaching Clinics / Group Lessons",
    clinicSub: "Bring Ballard's Academy to your center",
    storyEyebrow: "Our Story",
    story: "Elite Coaching. Family. Passion.",
    missionLabel: "Mission",
    mission:
      "To provide world-class coaching that will enhance the bowling experience to all bowlers and coaches while growing the sport of bowling at all levels on and off the lanes.",
    visionLabel: "Vision",
    vision: "To strengthen the bowling community through Education and Coaching.",
    storyBody:
      "Ballard's Bowling Academy was created from the love and passion for the sport of bowling. We believe there is a true inner Champion in all of us whether on the lanes or behind the scenes. There are many facets that lead to success and we look to help you develop a plan to achieve your personal goals. At Ballard's Bowling Academy we look to inspire you to reach your bowling goals as well as use the tools learned to achieve off-lane success as well.",
    dealEyebrow: "Deal of the Month",
    dealCta: "See deals & specials",
    shopEyebrow: "Pro Shop",
    featured: "Featured Gear",
    shopLink: "Shop all",
  };

  let t = { ...defaults };
  try {
    const [
      dealList,
      hero,
      heroSub,
      heroCta1,
      heroCta2,
      trainingEyebrow,
      training,
      trainingLink,
      lessonTitle,
      lessonSub,
      clinicTitle,
      clinicSub,
      storyEyebrow,
      story,
      missionLabel,
      mission,
      visionLabel,
      vision,
      storyBody,
      dealEyebrow,
      dealCta,
      shopEyebrow,
      featured,
      shopLink,
    ] = await Promise.all([
      listDeals(),
      getText("home", "hero", defaults.hero),
      getText("home", "hero_sub", defaults.heroSub),
      getText("home", "hero_cta_primary", defaults.heroCta1),
      getText("home", "hero_cta_secondary", defaults.heroCta2),
      getText("home", "training_eyebrow", defaults.trainingEyebrow),
      getText("home", "training", defaults.training),
      getText("home", "training_link", defaults.trainingLink),
      getText("home", "lesson_title", defaults.lessonTitle),
      getText("home", "lesson_sub", defaults.lessonSub),
      getText("home", "clinic_title", defaults.clinicTitle),
      getText("home", "clinic_sub", defaults.clinicSub),
      getText("home", "story_eyebrow", defaults.storyEyebrow),
      getText("home", "story", defaults.story),
      getText("home", "mission_label", defaults.missionLabel),
      getText("home", "mission", defaults.mission),
      getText("home", "vision_label", defaults.visionLabel),
      getText("home", "vision", defaults.vision),
      getText("home", "story_body", defaults.storyBody),
      getText("home", "deal_eyebrow", defaults.dealEyebrow),
      getText("home", "deal_cta", defaults.dealCta),
      getText("home", "shop_eyebrow", defaults.shopEyebrow),
      getText("home", "featured", defaults.featured),
      getText("home", "shop_link", defaults.shopLink),
    ]);
    deals = dealList;
    t = {
      hero,
      heroSub,
      heroCta1,
      heroCta2,
      trainingEyebrow,
      training,
      trainingLink,
      lessonTitle,
      lessonSub,
      clinicTitle,
      clinicSub,
      storyEyebrow,
      story,
      missionLabel,
      mission,
      visionLabel,
      vision,
      storyBody,
      dealEyebrow,
      dealCta,
      shopEyebrow,
      featured,
      shopLink,
    };
  } catch {
    deals = [];
  }

  const deal = deals.find((d) => d.featured && d.active) || deals.find((d) => d.active);

  return (
    <>
      <HeroSlider
        heroTitle={t.hero}
        heroSub={t.heroSub}
        ctaPrimary={t.heroCta1}
        ctaSecondary={t.heroCta2}
      />

      <section className="site-shell section-pad">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <EditablePageTitle
              page="home"
              slot="training_eyebrow"
              initial={t.trainingEyebrow}
              as="p"
              className="text-sm tracking-[0.2em] text-red uppercase"
            />
            <EditablePageTitle
              page="home"
              slot="training"
              initial={t.training}
              as="h2"
              className="display text-4xl md:text-5xl"
            />
          </div>
          <Link href="/coaching" className="text-sm text-mist underline decoration-red/40">
            <EditablePageTitle
              page="home"
              slot="training_link"
              initial={t.trainingLink}
              as="span"
              className="inline"
            />
          </Link>
        </div>
          <div className="grid gap-5 md:grid-cols-2">
          <Link
            href="/coaching"
            className="group relative min-h-[280px] overflow-hidden rounded-3xl border border-white/15"
          >
            <div className="media-box absolute inset-0">
              <Image
                src="/images/collections/bowling-lessons.png"
                alt="Bowling Lessons"
                fill
                className="img-clean p-4 transition duration-700 group-hover:scale-105"
                unoptimized
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-6 pt-16">
              <EditablePageTitle
                page="home"
                slot="lesson_title"
                initial={t.lessonTitle}
                as="h3"
                className="display text-3xl"
              />
              <EditablePageTitle
                page="home"
                slot="lesson_sub"
                initial={t.lessonSub}
                as="p"
                className="mt-1 text-sm text-mist"
              />
            </div>
          </Link>
          <Link
            href="/coaching"
            className="group relative min-h-[280px] overflow-hidden rounded-3xl border border-white/15"
          >
            <div className="media-box absolute inset-0">
              <Image
                src="/images/collections/clinics.jpg"
                alt="Coaching Clinics"
                fill
                className="img-clean p-4 transition duration-700 group-hover:scale-105"
                unoptimized
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-6 pt-16">
              <EditablePageTitle
                page="home"
                slot="clinic_title"
                initial={t.clinicTitle}
                as="h3"
                className="display text-3xl"
              />
              <EditablePageTitle
                page="home"
                slot="clinic_sub"
                initial={t.clinicSub}
                as="p"
                className="mt-1 text-sm text-mist"
              />
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
          <EditablePageTitle
            page="home"
            slot="story_eyebrow"
            initial={t.storyEyebrow}
            as="p"
            className="text-sm tracking-[0.22em] text-red uppercase"
          />
          <EditablePageTitle
            page="home"
            slot="story"
            initial={t.story}
            as="h2"
            className="display mt-2 max-w-3xl text-4xl md:text-6xl"
          />
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div className="space-y-5 text-mist leading-relaxed">
              <div>
                <EditablePageTitle
                  page="home"
                  slot="mission_label"
                  initial={t.missionLabel}
                  as="strong"
                  editLabel="Mission label"
                  className="text-chalk"
                />
                <span className="text-mist"> – </span>
                <EditablePageTitle
                  page="home"
                  slot="mission"
                  initial={t.mission.replace(/^Mission\s*[–—-]\s*/i, "")}
                  as="p"
                  multiline
                  rows={5}
                  editLabel="Mission paragraph"
                  className="mt-2 leading-relaxed text-mist"
                />
              </div>
              <div>
                <EditablePageTitle
                  page="home"
                  slot="vision_label"
                  initial={t.visionLabel}
                  as="strong"
                  editLabel="Vision label"
                  className="text-chalk"
                />
                <span className="text-mist"> – </span>
                <EditablePageTitle
                  page="home"
                  slot="vision"
                  initial={t.vision.replace(/^Vision\s*[–—-]\s*/i, "")}
                  as="p"
                  multiline
                  rows={4}
                  editLabel="Vision paragraph"
                  className="mt-2 leading-relaxed text-mist"
                />
              </div>
            </div>
            <EditablePageTitle
              page="home"
              slot="story_body"
              initial={t.storyBody}
              as="p"
              multiline
              rows={8}
              editLabel="Story paragraph"
              className="leading-relaxed text-mist"
            />
          </div>
        </div>
      </section>

      {deal && (
        <section className="site-shell section-pad">
          <div className="grid items-center gap-8 overflow-hidden rounded-[2rem] border border-red/30 bg-gradient-to-br from-lane/80 to-ink lg:grid-cols-2">
            <div className="media-box relative min-h-[320px] p-4">
              <Image
                src={deal.image}
                alt={deal.title}
                fill
                className="img-clean"
                unoptimized
              />
            </div>
            <div className="p-8 md:p-10">
              <EditablePageTitle
                page="home"
                slot="deal_eyebrow"
                initial={t.dealEyebrow}
                as="p"
                className="text-sm tracking-[0.2em] text-red uppercase"
              />
              <h2 className="display mt-2 text-4xl md:text-5xl">{deal.title}</h2>
              <p className="mt-4 text-mist">{deal.description}</p>
              <Link href="/deals" className="btn btn-primary mt-6">
                <EditablePageTitle
                  page="home"
                  slot="deal_cta"
                  initial={t.dealCta}
                  as="span"
                  className="inline"
                />
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="site-shell section-pad pt-0">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <EditablePageTitle
              page="home"
              slot="shop_eyebrow"
              initial={t.shopEyebrow}
              as="p"
              className="text-sm tracking-[0.2em] text-red uppercase"
            />
            <EditablePageTitle
              page="home"
              slot="featured"
              initial={t.featured}
              as="h2"
              className="display text-4xl md:text-5xl"
            />
          </div>
          <Link href="/shop" className="text-sm text-mist underline decoration-red/40">
            <EditablePageTitle
              page="home"
              slot="shop_link"
              initial={t.shopLink}
              as="span"
              className="inline"
            />
          </Link>
        </div>
        <EditableProductGrid initial={[]} filters={{ featuredOnly: true, limit: 4 }} />
      </section>
    </>
  );
}
