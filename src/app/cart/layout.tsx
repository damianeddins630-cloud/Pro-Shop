import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cart",
  description:
    "Review your Ballard's Bowling Academy cart. Pickup in store — we do not ship.",
};

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
