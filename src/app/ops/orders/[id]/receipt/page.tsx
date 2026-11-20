"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Order } from "@/lib/types";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function OpsOrderReceiptPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const res = await fetch(`/api/orders/${id}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not load order");
        return;
      }
      setOrder(data.order || null);
    })();
  }, [id]);

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-300">{error}</p>
        <Link href="/ops/orders">← Sales & Orders</Link>
      </div>
    );
  }
  if (!order) return <p className="p-8 text-mist">Loading receipt…</p>;

  const subtotal =
    order.subtotal ??
    (order.items || []).reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = order.discountAmount || 0;
  const tax = order.taxAmount || 0;
  const refund = order.refundAmount || 0;

  return (
    <div className="receipt-page mx-auto max-w-2xl bg-white text-black p-8 print:p-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .ops-sidebar, .ops-topbar, .ops-menu-btn, .ops-backdrop { display: none !important; }
          .ops-shell { display: block !important; background: white !important; }
          .ops-main { margin: 0 !important; }
          .ops-content { padding: 0 !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print mb-6 flex gap-2">
        <button
          type="button"
          className="ops-primary-btn"
          onClick={() => window.print()}
        >
          Print receipt
        </button>
        <Link href="/ops/orders" className="ops-ghost-btn">
          ← Orders
        </Link>
      </div>

      <header className="border-b-2 border-black pb-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logo.png"
          alt="Ballard's Bowling Academy"
          width={72}
          height={72}
          className="mx-auto mb-2"
        />
        <h1 className="text-2xl font-bold tracking-wide">
          Ballard&apos;s Bowling Academy
        </h1>
        <p className="text-sm">Pro Shop · In-store pickup only</p>
        <p className="text-xs mt-1">Official sales receipt</p>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p>
            <strong>Order #</strong> {order.id}
          </p>
          <p>
            <strong>Date</strong>{" "}
            {new Date(order.createdAt).toLocaleString()}
          </p>
          <p>
            <strong>Status</strong> {order.status}
          </p>
        </div>
        <div>
          <p>
            <strong>Customer</strong> {order.username}
          </p>
          <p>{order.email}</p>
          {order.phoneNumber ? <p>{order.phoneNumber}</p> : null}
          <p>
            <strong>Payment</strong>{" "}
            {order.paymentProvider || order.paymentMethod || "—"}
          </p>
        </div>
      </section>

      <table className="mt-6 w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-2">Item</th>
            <th className="py-2">Qty</th>
            <th className="py-2">Price</th>
            <th className="py-2 text-right">Line</th>
          </tr>
        </thead>
        <tbody>
          {(order.items || []).map((item, i) => (
            <tr key={`${item.productId}-${i}`} className="border-b border-gray-300">
              <td className="py-2">
                {item.name}
                {item.weight ? ` (${item.weight} lb)` : ""}
              </td>
              <td className="py-2">{item.quantity}</td>
              <td className="py-2">{money(item.price)}</td>
              <td className="py-2 text-right">
                {money(item.price * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-4 ml-auto w-56 text-sm space-y-1">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        {discount > 0 ? (
          <div className="flex justify-between">
            <span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span>
            <span>-{money(discount)}</span>
          </div>
        ) : null}
        {tax > 0 ? (
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{money(tax)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-black pt-2 font-bold text-base">
          <span>Total paid</span>
          <span>{money(order.total)}</span>
        </div>
        {refund > 0 ? (
          <div className="flex justify-between text-red-700">
            <span>Refunded</span>
            <span>-{money(refund)}</span>
          </div>
        ) : null}
      </section>

      <footer className="mt-10 border-t border-black pt-4 text-center text-xs">
        <p>Thank you for shopping Ballard&apos;s Bowling Academy.</p>
        <p>Pickup and drilling in store — we do not ship.</p>
        <p className="mt-2">Strike · Train · Achieve</p>
      </footer>
    </div>
  );
}
