/** Ballard's is in-store only — no shipping. */

export const STORE_NAME = "Ballard's Bowling Academy Pro Shop";

export const IN_STORE_POLICY =
  "In-store only. No shipping. Buy online, then come in for drilling.";

export const IN_STORE_SHORT =
  "Come in for drilling — we do not ship.";

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
    text: "Choose your ball and weight. Pay on this site.",
  },
  {
    n: "02",
    title: "Balls in",
    text: "Your order shows Balls in when it is at Ballard's.",
  },
  {
    n: "03",
    title: "Come do drilling",
    text: "Come into the pro shop and get your ball drilled. No shipping.",
  },
  {
    n: "04",
    title: "Order complete",
    text: "When drilling is done and you pick up, the order is complete.",
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
    title: "Balls in",
    text: "Paid / on the shelf — waiting for the customer.",
  },
  {
    n: "3",
    title: "Come do drilling",
    text: "Customer comes in for drilling at the pro shop.",
  },
  {
    n: "4",
    title: "Order complete",
    text: "Drilled and handed off — done.",
  },
];

export function orderNeedsInStoreVisit(items: { weight?: number }[]) {
  return items.some((i) => i.weight != null);
}
