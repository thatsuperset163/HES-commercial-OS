# Harris Exterior Solutions — HQ

Private company HQ for **Harris Exterior Solutions**:

- **HQ** — daily overview
- **Personal / Work** — blackboard checklists + door metrics
- **Sales** (`/sales`) — commercial pipeline (prospects, emails, analytics)

PIN-protected. Data stays in the browser (`localStorage`). Built for **Vercel**.

Door hangers and print leave-behinds were removed — this repo is the live HQ app only.

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

That rebuilds into `public/sales/` (commit those files before deploy).

## Environment (Vercel + local)

| Variable | Purpose |
|----------|---------|
| `APP_PIN` | Login PIN |
| `AUTH_SECRET` | Signs the auth cookie (long random string in production) |

## Deploy on Vercel

1. Push this repo to GitHub.
2. Import it in Vercel (Framework: Next.js).
3. Set `APP_PIN` and `AUTH_SECRET` in Project → Settings → Environment Variables.
4. Deploy.

One URL for Blackboard + Commercial Sales OS. Edit here → push → Vercel updates.
