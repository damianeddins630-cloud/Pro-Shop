import { EditableDeals } from "@/components/EditableDeals";
import { EditablePageTitle } from "@/components/EditablePageTitle";
import { getText, listDeals } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const [allDeals, eyebrow, title, intro, empty] = await Promise.all([
    listDeals(),
    getText("deals", "eyebrow", "Specials"),
    getText("deals", "title", "Deals and Specials"),
    getText(
      "deals",
      "intro",
      "Deal of the month and seasonal offers from Ballard's Bowling Academy Pro Shop."
    ),
    getText("deals", "empty", "No active deals right now — check back soon."),
  ]);
  const deals = allDeals.filter((d) => d.active);

  return (
    <>
      <section className="site-shell section-pad pt-24">
        <EditablePageTitle
          page="deals"
          slot="eyebrow"
          initial={eyebrow}
          as="p"
          className="text-sm tracking-[0.22em] text-red uppercase"
        />
        <EditablePageTitle
          page="deals"
          slot="title"
          initial={title}
          as="h1"
          className="display mt-2 text-5xl md:text-7xl"
        />
        <EditablePageTitle
          page="deals"
          slot="intro"
          initial={intro}
          as="p"
          multiline
          rows={3}
          className="mt-4 max-w-2xl text-mist"
        />
      </section>

      <section className="site-shell pb-20">
        <EditableDeals initial={deals} />
        {deals.length === 0 && (
          <EditablePageTitle
            page="deals"
            slot="empty"
            initial={empty}
            as="p"
            className="text-mist"
          />
        )}
      </section>
    </>
  );
}
