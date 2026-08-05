/** Ballard's is in-store only — no shipping. */

export const STORE_NAME = "Ballard's Bowling Academy Pro Shop";

export const IN_STORE_POLICY =
  "In-store only. No shipping. Buy online, then come in for drilling and pickup.";

export const IN_STORE_SHORT =
  "Come in for drilling & pickup — we do not ship.";

export type JourneyStep = {
  n: string;
  title: string;
  text: string;
};

/** Customer-facing how the pro shop works */
export const CUSTOMER_JOURNEY: JourneyStep[] = [
  {
    n: "01",
    title: "Buy online",
    text: "Choose your ball and weight. Pay securely on this site.",
  },
  {
    n: "02",
    title: "Come in",
    text: "Visit Ballard's — there is no shipping. Everything is in-store.",
  },
  {
    n: "03",
    title: "Get drilled",
    text: "We drill your ball at the pro shop to your specs.",
  },
  {
    n: "04",
    title: "Take it home",
    text: "When status shows Ready / Completed, your gear is yours.",
  },
];

/** Staff-facing pipeline meaning */
export const STAFF_WORKFLOW: JourneyStep[] = [
  {
    n: "1",
    title: "Pending payment",
    text: "Shopify invoice open — stock not pulled yet.",
  },
  {
    n: "2",
    title: "Received",
    text: "Paid / recorded — queue for the drill bay.",
  },
  {
    n: "3",
    title: "In prep",
    text: "Measuring / drilling / finishing in the shop.",
  },
  {
    n: "4",
    title: "Ready",
    text: "Customer can come in — notify them if needed.",
  },
  {
    n: "5",
    title: "Completed",
    text: "Handed off in person at the pro shop.",
  },
];

export function orderNeedsInStoreVisit(items: { weight?: number }[]) {
  return items.some((i) => i.weight != null);
}
