# Harris Exterior Solutions — HQ

Private company HQ for **Harris Exterior Solutions**:

- **HQ** — daily overview
- **Work** — launcher for peer operating systems
- **Sales OS** (`/work/sales/`) — commercial pipeline & outreach
- **Jobs OS** (`/work/jobs`) — schedule → run → done
- **Next Work OSes** — Money, Inbox/Leads, Reputation (see `docs/OS-ROADMAP.md`)
- **Personal** — parked for now (pillars already exist at `/personal`)

PIN-protected HQ. Data syncs through **Supabase** with browser storage as an offline backup. Built for **Vercel**.

**Public website:** `/site` (no login) — estimate form writes into **Requests Center** (`intake_requests` in Supabase).  
**Requests Center:** `/work/requests` — kanban intake (new → response → estimate → waiting → approved/declined). Run `supabase/migrations/20260718042000_requests_center.sql` once.

Door hangers and print leave-behinds were removed — this repo is the live HQ + public site.

## Edit locally (Cursor)

```bash
npm install
cd crm && npm install && cd ..
cp .env.example .env.local
npm run sync:sales
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Default PIN: `twins6` (change it).

### After changing Sales OS (`crm/`)

```bash
npm run sync:sales
```

That rebuilds into `public/work/sales/` (commit those files before deploy).

## Environment (Vercel + local)

| Variable | Purpose |
|----------|---------|
| `APP_PIN` | Login PIN |
| `AUTH_SECRET` | Signs the auth cookie (long random string in production) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Required** for durable cloud saves across the whole site (Sales v2 + HQ/Jobs blackboard). Without it, data may stay browser-only. |

Copy `.env.example` → `.env.local` and fill in values for local work. On Vercel, add the **same variable names** under Project → Settings → Environment Variables, then **redeploy**.

**Supabase data:** run the latest `supabase/schema.sql` in the SQL Editor. With Sales v2 (sync pill says **Cloud: Sales v2**), prospects live in **`companies`**, **`contacts`**, and **`opportunities`** — not only `commercial_prospects`. HQ / Personal / Jobs blackboard state is in **`blackboard_workspace`**. Details: [`supabase/README.md`](./supabase/README.md).

**Before trusting live data:**
- **Whole site (HQ / Jobs / Personal):** sidebar and top bar should say **Cloud synced** (green). If it says **Local only**, **Cloud offline**, or **Save error**, fixes may only live in that browser.
- **Sales:** open `/work/sales/` and confirm the pill says **Cloud: Sales v2** (green).

## Deploy on Vercel

1. Push this repo to GitHub.
2. Import it in Vercel (Framework: Next.js).
3. Set `APP_PIN`, `AUTH_SECRET`, and the Supabase vars above.
4. Deploy.

One URL for the complete HES Operating System. Edit here → push → Vercel updates.
