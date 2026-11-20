import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";
import { isPurchasedOrder } from "@/lib/order-status";
import { storePersistStatus } from "@/lib/store";
import {
  listAllOrdersForOps,
  listProducts,
  listUsers,
  listSubscribers,
} from "@/lib/store";
import { assessShopifyReadiness, loadShopifyRuntimeConfig } from "@/lib/shopify";

export const dynamic = "force-dynamic";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1);
}

function inRange(iso: string | undefined, from: Date) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= from.getTime();
}

export async function GET() {
  const session = await requireAnyPermission(
    "manage_inventory",
    "view_orders",
    "manage_orders",
    "manage_users",
    "manage_roles",
    "edit_pages"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [orders, products, users, subscribers] = await Promise.all([
    listAllOrdersForOps(),
    listProducts({ includeInactive: true }),
    listUsers(),
    listSubscribers().catch(() => []),
  ]);

  await loadShopifyRuntimeConfig();
  const shopify = await assessShopifyReadiness();
  const persist = storePersistStatus();

  const paid = orders.filter(isPurchasedOrder);
  const now = new Date();
  const day = startOfDay(now);
  const month = startOfMonth(now);
  const year = startOfYear(now);

  const sum = (list: typeof paid) =>
    list.reduce((s, o) => s + Math.max(0, Number(o.total) || 0), 0);

  const todayOrders = paid.filter((o) => inRange(o.createdAt, day));
  const monthOrders = paid.filter((o) => inRange(o.createdAt, month));
  const yearOrders = paid.filter((o) => inRange(o.createdAt, year));

  // Daily sales for current month (real paid only)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailySales = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const total = monthOrders
      .filter((o) => new Date(o.createdAt).getDate() === dayNum)
      .reduce((s, o) => s + Math.max(0, Number(o.total) || 0), 0);
    return { day: dayNum, total: Math.round(total * 100) / 100 };
  });

  const activeProducts = products.filter((p) => p.active);
  const lowStock = activeProducts.filter((p) => (p.stock || 0) > 0 && (p.stock || 0) <= 3);
  const needsPrice = products.filter((p) => Number(p.price) <= 0);
  const avgOrder =
    paid.length > 0 ? Math.round((sum(paid) / paid.length) * 100) / 100 : 0;

  const recentOrders = [...paid]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 8)
    .map((o) => ({
      id: o.id,
      username: o.username,
      email: o.email,
      total: o.total,
      status: o.status,
      createdAt: o.createdAt,
      itemCount: o.items?.length || 0,
    }));

  const customers = users.filter((u) => u.role !== "admin" && u.id !== "user_owner");

  return NextResponse.json(
    {
      generatedAt: now.toISOString(),
      sales: {
        today: Math.round(sum(todayOrders) * 100) / 100,
        month: Math.round(sum(monthOrders) * 100) / 100,
        year: Math.round(sum(yearOrders) * 100) / 100,
        allTime: Math.round(sum(paid) * 100) / 100,
        orderCountToday: todayOrders.length,
        orderCountMonth: monthOrders.length,
        orderCountAll: paid.length,
        averageOrder: avgOrder,
        dailySales,
      },
      // Honest placeholders until those modules exist — never invent revenue.
      coaching: {
        revenueCollected: 0,
        sessionsBooked: 0,
        available: false,
        note: "Coaching Management comes in a later stage. No coaching revenue is recorded yet.",
      },
      memberships: {
        revenueCollected: 0,
        activeCount: 0,
        available: false,
        note: "Membership Management comes in a later stage. No membership revenue is recorded yet.",
      },
      inventory: {
        productCount: products.length,
        activeCount: activeProducts.length,
        lowStockCount: lowStock.length,
        needsPriceCount: needsPrice.length,
        unitsInStock: activeProducts.reduce((s, p) => s + (p.stock || 0), 0),
      },
      customers: {
        accountCount: customers.length,
        subscriberCount: Array.isArray(subscribers) ? subscribers.length : 0,
      },
      recentOrders,
      system: {
        durableWriteConfigured: persist.durableWriteConfigured,
        lastPersistOk: persist.lastPersistOk,
        lastPersistDetail: persist.lastPersistDetail,
        shopifyCheckoutReady: Boolean(shopify.public.checkoutReady),
        shopifyConfigured: Boolean(shopify.public.configured),
        shopifyWebhookConfigured: Boolean(shopify.public.webhookConfigured),
        googleSheetsConnected: false,
        googleSheetsNote:
          "Google Sheets backup is planned. Durable Blob/Redis/GitHub is the live source of truth today.",
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
