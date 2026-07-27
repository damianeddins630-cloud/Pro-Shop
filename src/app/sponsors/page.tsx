import { EditablePageTitle } from "@/components/EditablePageTitle";
import { EditableSponsors } from "@/components/EditableSponsors";
import { getText, listSponsors } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SponsorsPage() {
  const [sponsors, eyebrow, title, intro] = await Promise.all([
    listSponsors(),
    getText("sponsors", "eyebrow", "Partners"),
    getText("sponsors", "title", "Thank You To All Of Our Sponsors!"),
    getText(
      "sponsors",
      "intro",
      'These partners help fuel Ballard\'s Bowling Academy and Ballard vs. The Big "C".'
    ),
  ]);

  return (
    <section className="site-shell section-pad pt-24">
      <EditablePageTitle
        page="sponsors"
        slot="eyebrow"
        initial={eyebrow}
        as="p"
        className="text-sm tracking-[0.22em] text-red uppercase"
      />
      <EditablePageTitle
        page="sponsors"
        slot="title"
        initial={title}
        as="h1"
        className="display mt-2 text-5xl md:text-7xl"
      />
      <EditablePageTitle
        page="sponsors"
        slot="intro"
        initial={intro}
        as="p"
        multiline
        rows={3}
        className="mt-4 max-w-2xl text-mist"
      />
      <EditableSponsors initial={sponsors} />
    </section>
  );
}
