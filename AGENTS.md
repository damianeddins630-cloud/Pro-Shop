# AGENTS.md

## Cursor Cloud specific instructions

This is a single Next.js 16 (App Router, TypeScript, React 19) application — the entire product (storefront, cart/checkout, accounts, and `/admin` tools) runs in one process. There are no external services (no database, cache, payment, email, or object storage); persistence is a local JSON file created automatically.

### Services

Only one service is needed to run/test end to end:

- Next.js dev server: `npm run dev` (serves `http://localhost:3000`). Standard scripts live in `package.json` (`dev`, `build`, `start`, `lint`).
- Health check: `GET /api/health` returns `{ "ok": true, productCount, ... }`.

### Non-obvious notes

- Data store: state persists to `data/runtime.json` in dev (git-ignored) and `/tmp/bba-store.json` on Vercel/Lambda. It is seeded from `src/data/seed.json`. To reset local state, delete `data/runtime.json`.
- Auth: `AUTH_SECRET` is optional in dev — `src/lib/auth.ts` falls back to a hardcoded dev secret if unset, so no `.env` is required to run locally.
- Seeded owner/admin login (for admin flows at `/admin`): username `Damian_e`, password `Archer6!9`.
- Checkout requires being logged in; register a user first (or use the owner login) before placing an order.
- `npm run lint` currently reports pre-existing errors in `src/lib/edit-mode.tsx` (`react-hooks/set-state-in-effect`). These are code issues, not environment issues.
