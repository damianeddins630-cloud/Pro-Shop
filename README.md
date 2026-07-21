# Ballard's Bowling Academy Pro Shop

Next.js website for Ballard's Bowling Academy with inventory, cart, accounts, and admin tools.

## Owner login

- Username: `Damian_e`
- Password: `Archer6!9`
- Admin: `/admin`

## Local

```bash
npm install
npm run dev
```

## Vercel (important)

1. Import GitHub repo `damianeddins630-cloud/Pro-Shop`
2. Framework: **Next.js** (auto)
3. Root directory: `.` (repo root)
4. Env var: `AUTH_SECRET` = long random string
5. **Settings → Deployment Protection → turn OFF Vercel Authentication**
   - If this stays on, the site redirects to Vercel login and many browsers show “page couldn’t load”
6. Deploy production from branch **`main`**

Health check after deploy: `https://YOUR-DOMAIN/api/health` should return `{ "ok": true, ... }`.
