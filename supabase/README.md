# Supabase setup (HES HQ + Commercial Sales OS)

Your Sales OS and Blackboard data can live in one Supabase project so changes sync across devices.

## 1. Create tables (one-time)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. Go to **SQL Editor** → New query
3. Paste and run everything in [`supabase/schema.sql`](./schema.sql)

## 2. Environment variables

In `.env.local` (local) **and** Vercel → Settings → Environment Variables:

| Name | Where to find it |
|------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` (optional but better) | Project Settings → API → `service_role` secret |

Redeploy Vercel after adding vars.

## 3. Use the app

1. Open your Vercel site → log in with PIN → **Sales**
2. Sidebar should say **Cloud: Supabase**
3. Add/edit a prospect
4. In Supabase go to **Table Editor** → **`commercial_prospects`**

You’ll also see:

- Full Sales backup JSON in **`sales_workspace`**
- Combined HQ, Personal, and Work state in **`blackboard_workspace`**

Browser storage remains available as an offline backup for both apps.

## If it says “Cloud: local only”

Env vars are missing on that environment, or the SQL schema was never run.
