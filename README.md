# Ballard's Bowling Academy Pro Shop

Next.js website for Ballard's Bowling Academy with inventory, cart, accounts, admin tools, and Shopify payments.

## Owner login

- Username: `CV_damian`
- Password: `Archer6!9`
- Operations: `/ops`

## How shopping + Shopify works

1. Customers browse products and use the cart **on this website**
2. At checkout they click **Pay with Shopify**
3. Shopify collects the money on its secure payment page
4. The order is saved on this website (Profile → Previous orders)
5. After paying they can return to `/order/success`

## Connect Shopify (required to take real payments)

In Shopify Admin:

1. **Settings → Apps and sales channels → Develop apps → Create an app**
2. Configure Admin API scopes:
   - `write_draft_orders`
   - `read_draft_orders`
   - `read_orders`
3. Install the app and copy the **Admin API access token**
4. Optional webhook: topic `orders/paid` → `https://YOUR-DOMAIN/api/shopify/webhook`

In Vercel → Project → Settings → Environment Variables, add:

```
AUTH_SECRET=...
NEXT_PUBLIC_SITE_URL=https://YOUR-DOMAIN

# Required so inventory add/edit/delete shows on the shop for everyone
GITHUB_TOKEN=ghp_xxx   # GitHub PAT with repo scope
GITHUB_REPO=damianeddins630-cloud/Pro-Shop
GITHUB_BRANCH=main

SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...
SHOPIFY_API_VERSION=2025-01
SHOPIFY_WEBHOOK_SECRET=...   # optional but recommended
```

Redeploy after saving env vars. Cart button becomes **Pay with Shopify** when configured.

Buying requires login or create account (`Login to buy` on products).

## Local

```bash
npm install
npm run dev
```

## Vercel (important)

1. Import GitHub repo `damianeddins630-cloud/Pro-Shop`
2. Framework: **Next.js** (auto)
3. Root directory: `.` (repo root)
4. Set env vars above
5. **Settings → Deployment Protection → turn OFF Vercel Authentication**
6. Deploy production from branch **`main`**

Health check: `https://YOUR-DOMAIN/api/health` should return `{ "ok": true, ... }`.
