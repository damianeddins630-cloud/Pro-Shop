import { EditableDeals } from "@/components/EditableDeals";
import { EditablePageTitle } from "@/components/EditablePageTitle";
import { getText, listDeals } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const [allDeals, title] = await Promise.all([
    listDeals(),
    getText("deals", "title", "Deals and Specials"),
  ]);
  const deals = allDeals.filter((d) => d.active);

  return (
    <>
      <section className="site-shell section-pad pt-24">
        <p className="text-sm tracking-[0.22em] text-red uppercase">Specials</p>
        <EditablePageTitle
          page="deals"
          slot="title"
          initial={title}
          as="h1"
          className="display mt-2 text-5xl md:text-7xl"
        />
        <p className="mt-4 max-w-2xl text-mist">
          Deal of the month and seasonal offers from Ballard&apos;s Bowling Academy Pro Shop.
        </p>
      </section>

      <section className="site-shell pb-20">
        <EditableDeals initial={deals} />
        {deals.length === 0 && (
          <p className="text-mist">No active deals right now — check back soon.</p>
        )}
      </section>
    </>
  );
}
