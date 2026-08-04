# Ballard's Bowling Academy Pro Shop

Next.js website for Ballard's Bowling Academy with inventory, cart, accounts, Operations admin, and Shopify **checkout-only** payments.

## Owner login

- Username: `CV_damian`
- Password: `Archer6!9`
- Operations: `/ops`

## Architecture (important)

**Your website is the source of truth.**

| Managed on this website | Managed by Shopify |
|---|---|
| Products, prices, inventory, images | Checkout / payment page |
| Categories, deals, coupons, sponsors | Card / Shop Pay / Apple Pay / Google Pay |
| Ops admin for employees | Taxes & shipping at checkout |
| Order records on the site | Payment processing |

Shopify does **not** own your product catalog. Employees should manage products only in **Operations (`/ops`)**.

Flow:

1. Customer browses/carts on this website
2. Checkout creates a **Shopify Draft Order** from the cart
3. Customer pays on Shopify
4. Website marks the order paid and reduces its own inventory

No Storefront API token is required.

## Connect Shopify (take real payments)

### 1) Shopify Admin custom app

1. **Settings → Apps and sales channels → Develop apps → Create an app**
2. Admin API scopes:
   - `write_draft_orders`
   - `read_draft_orders`
   - `read_orders`
3. Install the app and copy the **Admin API access token** (`shpat_...`)
4. Note your store domain: `your-store.myshopify.com`
5. Optional but recommended webhook:
   - Topic: `orders/paid`
   - URL: `https://YOUR-DOMAIN/api/shopify/webhook`
   - Copy the webhook signing secret

Keep this custom app — it is required for Draft Order checkout.

### 2) Vercel environment variables

Project → **Settings → Environment Variables** (Production):

```
AUTH_SECRET=long-random-secret
NEXT_PUBLIC_SITE_URL=https://YOUR-DOMAIN

# REQUIRED so accounts, inventory, and role changes survive on Vercel
# Create a GitHub Personal Access Token with "repo" scope
GITHUB_TOKEN=ghp_xxx
GITHUB_REPO=damianeddins630-cloud/Pro-Shop
GITHUB_BRANCH=main

# Shopify checkout-only
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...
SHOPIFY_API_VERSION=2025-01
SHOPIFY_WEBHOOK_SECRET=...   # optional but recommended
```

**Without `GITHUB_TOKEN`, new customer accounts can disappear** after a new server starts (Vercel’s disk is temporary). This token is required for a live shop.

Do **not** add a Storefront API token. This site does not use it.

### 3) Redeploy

After saving env vars, redeploy Production. Cart checkout becomes **Pay with Shopify**.

Buying requires login / create account.

## Local

```bash
npm install
npm run dev
```

## Vercel checklist

1. Import GitHub repo `damianeddins630-cloud/Pro-Shop`
2. Framework: **Next.js**
3. Deploy from **`main`**
4. Set env vars above
5. Turn OFF Vercel Deployment Protection / Authentication so customers can use the site
6. Health check: `https://YOUR-DOMAIN/api/health`

## Future note

`live-store.json` (+ GitHub durable writes) works for this shop today. A real database (PostgreSQL) can come later if many staff edit inventory at once — not required to launch Shopify payments.
