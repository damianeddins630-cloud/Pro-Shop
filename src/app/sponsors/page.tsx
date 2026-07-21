import { EditablePageTitle } from "@/components/EditablePageTitle";
import { EditableSponsors } from "@/components/EditableSponsors";
import { getText, listSponsors } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SponsorsPage() {
  const [sponsors, title] = await Promise.all([
    listSponsors(),
    getText("sponsors", "title", "Thank You To All Of Our Sponsors!"),
  ]);

  return (
    <section className="site-shell section-pad pt-24">
      <p className="text-sm tracking-[0.22em] text-red uppercase">Partners</p>
      <EditablePageTitle
        page="sponsors"
        slot="title"
        initial={title}
        as="h1"
        className="display mt-2 text-5xl md:text-7xl"
      />
      <p className="mt-4 max-w-2xl text-mist">
        These partners help fuel Ballard&apos;s Bowling Academy and Ballard vs. The Big &quot;C&quot;.
      </p>
      <EditableSponsors initial={sponsors} />
    </section>
  );
}
