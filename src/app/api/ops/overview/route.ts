import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";
import { isPurchasedOrder } from "@/lib/order-status";
import {
  businessRevenueSnapshot,
  listActivityLog,
  listBackupAttempts,
  getGoogleSheetsConfig,
  listAllOrdersForOps,
  listProducts,
  listUsers,
  listSubscribers,
  storePersistStatus,
} from "@/lib/store";
import { assessShopifyReadiness, loadShopifyRuntimeConfig } from "@/lib/shopify";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday start
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1);
}

function daysAgo(n: number, d = new Date()) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - n);
  return x;
}

function parseRange(url: URL): { from: Date; to: Date; label: string } {
  const range = (url.searchParams.get("range") || "30d").toLowerCase();
  const now = new Date();
  const to = now;
  if (range === "today") return { from: startOfDay(now), to, label: "today" };
  if (range === "7d") return { from: daysAgo(6), to, label: "7d" };
  if (range === "90d") return { from: daysAgo(89), to, label: "90d" };
  if (range === "custom") {
    const fromRaw = url.searchParams.get("from");
    const toRaw = url.searchParams.get("to");
    const from = fromRaw ? startOfDay(new Date(fromRaw)) : daysAgo(29);
    const toDate = toRaw ? new Date(toRaw) : now;
    toDate.setHours(23, 59, 59, 999);
    return { from, to: toDate, label: "custom" };
  }
  return { from: daysAgo(29), to, label: "30d" };
}

function inWindow(iso: string | undefined, from: Date, to: Date) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= from.getTime() && t <= to.getTime();
}

function sumOrders(list: Order[]) {
  return list.reduce((s, o) => {
    const total = Math.max(0, Number(o.total) || 0);
    const refund = Math.max(0, Number(o.refundAmount) || 0);
    return s + Math.max(0, total - refund);
  }, 0);
}

export async function GET(req: Request) {
  const session = await requireAnyPermission(
    "view_dashboard",
    "manage_inventory",
    "view_orders",
    "manage_orders",
    "manage_users",
    "manage_roles",
    "edit_pages",
    "view_finances"
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const { from, to, label } = parseRange(url);

  const [orders, products, users, subscribers, biz, activity, backups, sheets] =
    await Promise.all([
      listAllOrdersForOps(),
      listProducts({ includeInactive: true }),
      listUsers(),
      listSubscribers().catch(() => []),
      businessRevenueSnapshot(),
      listActivityLog(12),
      listBackupAttempts(5),
      getGoogleSheetsConfig(),
    ]);

  await loadShopifyRuntimeConfig();
  const shopify = await assessShopifyReadiness();
  const persist = storePersistStatus();

  const paid = orders.filter(isPurchasedOrder);
  const now = new Date();
  const day = startOfDay(now);
  const week = startOfWeek(now);
  const month = startOfMonth(now);
  const year = startOfYear(now);

  const rangeOrders = paid.filter((o) => inWindow(o.createdAt, from, to));
  const todayOrders = paid.filter((o) => inWindow(o.createdAt, day, now));
  const weekOrders = paid.filter((o) => inWindow(o.createdAt, week, now));
  const monthOrders = paid.filter((o) => inWindow(o.createdAt, month, now));
  const yearOrders = paid.filter((o) => inWindow(o.createdAt, year, now));

  // Daily series for selected range (cap ~90 points)
  const dayMs = 24 * 60 * 60 * 1000;
  const spanDays = Math.min(
    90,
    Math.max(1, Math.ceil((to.getTime() - from.getTime()) / dayMs) + 1)
  );
  const dailySales = Array.from({ length: spanDays }, (_, i) => {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const total = rangeOrders
      .filter((o) => (o.createdAt || "").slice(0, 10) === key)
      .reduce((s, o) => {
        const t = Math.max(0, Number(o.total) || 0);
        const r = Math.max(0, Number(o.refundAmount) || 0);
        return s + Math.max(0, t - r);
      }, 0);
    return {
      day: key,
      total: Math.round(total * 100) / 100,
    };
  });

  const activeProducts = products.filter((p) => p.active);
  const lowStock = activeProducts.filter((p) => {
    const threshold =
      typeof p.lowStockThreshold === "number" ? p.lowStockThreshold : 3;
    return (p.stock || 0) > 0 && (p.stock || 0) <= threshold;
  });
  const outOfStock = activeProducts.filter((p) => (p.stock || 0) <= 0);
  const needsPrice = products.filter((p) => Number(p.price) <= 0);
  const avgOrder =
    rangeOrders.length > 0
      ? Math.round((sumOrders(rangeOrders) / rangeOrders.length) * 100) / 100
      : 0;

  const shopMonth = Math.round(sumOrders(monthOrders) * 100) / 100;
  const shopRange = Math.round(sumOrders(rangeOrders) * 100) / 100;
  const shopAll = Math.round(sumOrders(paid) * 100) / 100;
  const collectedMonth =
    Math.round(
      (shopMonth + biz.coachingRevenue + biz.membershipRevenue) * 100
    ) / 100;
  const netProfit =
    Math.round((collectedMonth - biz.expensesTotal) * 100) / 100;

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
      refundAmount: o.refundAmount || 0,
    }));

  const customers = users.filter((u) => u.id !== "user_owner");
  const recentCustomers = [...customers]
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    )
    .slice(0, 6)
    .map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      createdAt: u.createdAt,
    }));

  const salesBreakdown = {
    shop: shopRange,
    coaching: biz.coachingRevenue,
    memberships: biz.membershipRevenue,
  };

  return NextResponse.json(
    {
      generatedAt: now.toISOString(),
      range: {
        label,
        from: from.toISOString(),
        to: to.toISOString(),
      },
      sales: {
        today: Math.round(sumOrders(todayOrders) * 100) / 100,
        week: Math.round(sumOrders(weekOrders) * 100) / 100,
        month: shopMonth,
        year: Math.round(sumOrders(yearOrders) * 100) / 100,
        range: shopRange,
        allTime: shopAll,
        orderCountToday: todayOrders.length,
        orderCountWeek: weekOrders.length,
        orderCountMonth: monthOrders.length,
        orderCountRange: rangeOrders.length,
        orderCountAll: paid.length,
        averageOrder: avgOrder,
        dailySales,
      },
      coaching: {
        revenueCollected: biz.coachingRevenue,
        sessionsBooked: biz.bookingCount,
        packages: biz.packageCount,
        upcomingLessons: biz.upcomingLessons,
        upcomingBookings: biz.upcomingBookings,
        available: true,
        note:
          biz.bookingCount === 0 && biz.packageCount === 0
            ? "No coaching bookings yet. Add lessons in Coaching Management. Only paid sessions count as revenue."
            : "Only bookings/packages marked paid count as collected revenue.",
      },
      memberships: {
        revenueCollected: biz.membershipRevenue,
        activeCount: biz.activeMemberships,
        totalCount: biz.membershipCount,
        available: true,
        note:
          biz.membershipCount === 0
            ? "No memberships yet. Unpaid/cancelled memberships never count as collected revenue."
            : "Only memberships with payment status paid count as collected revenue.",
      },
      finances: {
        shopRevenueMonth: shopMonth,
        coachingRevenue: biz.coachingRevenue,
        membershipRevenue: biz.membershipRevenue,
        totalCollectedMonth: collectedMonth,
        expensesTotal: biz.expensesTotal,
        netProfitMonth: netProfit,
      },
      salesBreakdown,
      inventory: {
        productCount: products.length,
        activeCount: activeProducts.length,
        lowStockCount: lowStock.length,
        outOfStockCount: outOfStock.length,
        needsPriceCount: needsPrice.length,
        unitsInStock: activeProducts.reduce((s, p) => s + (p.stock || 0), 0),
        alerts: [
          ...lowStock.slice(0, 6).map((p) => ({
            id: p.id,
            name: p.name,
            stock: p.stock,
            kind: "low" as const,
          })),
          ...outOfStock.slice(0, 4).map((p) => ({
            id: p.id,
            name: p.name,
            stock: p.stock,
            kind: "out" as const,
          })),
        ],
      },
      customers: {
        accountCount: customers.length,
        subscriberCount: Array.isArray(subscribers) ? subscribers.length : 0,
        recent: recentCustomers,
      },
      recentOrders,
      activity,
      system: {
        durableWriteConfigured: persist.durableWriteConfigured,
        lastPersistOk: persist.lastPersistOk,
        lastPersistDetail: persist.lastPersistDetail,
        shopifyCheckoutReady: Boolean(shopify.public.checkoutReady),
        shopifyConfigured: Boolean(shopify.public.configured),
        shopifyWebhookConfigured: Boolean(shopify.public.webhookConfigured),
        googleSheetsConnected: Boolean(sheets.connected && sheets.spreadsheetId),
        googleSheetsNote: sheets.connected
          ? sheets.lastBackupDetail || "Google Sheets config saved"
          : "Google Sheets backup is not connected yet. Durable Blob/Redis/GitHub is the live source of truth.",
        lastBackupAt: sheets.lastBackupAt || backups[0]?.at || null,
        recentBackups: backups,
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
