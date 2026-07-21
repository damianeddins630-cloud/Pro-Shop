# Ballard's Bowling Academy Pro Shop

Next.js website for Ballard's Bowling Academy with:

- Home, Coaching, Shop/Inventory, Deals, BVBC charity, Sponsors, Subscribe
- Customer accounts (email, username, password, phone, date of birth)
- Login with username **or** email + password
- Shopping cart + checkout that updates inventory stock
- Admin dashboard for inventory, deals, and sponsors (add / edit / delete / upload images)

Uses real photos and product imagery from [ballardsbowlingacademy.com](https://ballardsbowlingacademy.com/).

## Owner login

- Username: `Damian_e`
- Password: `Archer6!9`
- Full admin permissions at `/admin`

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Import this GitHub repo in Vercel.
2. Set environment variable `AUTH_SECRET` to a long random string.
3. Deploy (framework: Next.js — auto-detected).

Inventory/users persist in memory + `/tmp` on Vercel (warm instances). For long-term production persistence across all serverless instances, connect a database later; the admin/API layer is already structured for that.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — start production server
- `npm run lint` — lint
