# Supabase setup (HES HQ + Commercial Sales OS)

The legacy Sales OS and Blackboard tables remain operational while the
normalized sales schema is introduced additively.

## Exact run order

### Existing Supabase project

1. Take a Supabase database backup or verify point-in-time recovery.
2. Open Supabase Dashboard → **SQL Editor** → **New query**.
3. Run
   [`migrations/20260716170000_phase1_normalized_sales.sql`](./migrations/20260716170000_phase1_normalized_sales.sql)
   once as a database owner.
4. Review the normalized row counts and spot-check several records against
   `commercial_prospects`.
5. The migration is idempotent and may be run again. Inserts use stable IDs
   and conflict handling.

### Fresh Supabase project

1. Open Supabase Dashboard → **SQL Editor** → **New query**.
2. Run all of [`schema.sql`](./schema.sql). It creates both the legacy and
   normalized schema in dependency order and performs the same backfill.

Do not run `schema.sql` and then the migration on a fresh project as a required
second step; `schema.sql` already contains the migration's final state.

## Environment variables and security

Configure these locally and in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`: Project Settings → API → Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Project Settings → API → publishable/anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Project Settings → API → service-role secret

`SUPABASE_SERVICE_ROLE_KEY` is **required for durable cloud saves across the
whole site** (normalized Sales reads/writes and recommended for HQ/Jobs
blackboard) and must only be used in server-side code. Never expose it through a
`NEXT_PUBLIC_` variable or browser bundle.

RLS is enabled on every normalized table and Phase 1 intentionally creates no
permissive anon/authenticated policies. The current permissive legacy policies
on `sales_workspace`, `commercial_prospects`, and `blackboard_workspace` remain
unchanged because the live app still supports the publishable-key fallback.

## Backfill behavior

- Company and opportunity IDs equal the source `commercial_prospects.id`.
- Primary decision-maker and assistant/gatekeeper contacts use deterministic
  `:primary` and `:assistant` ID suffixes.
- Legacy sales reps receive deterministic user IDs; `Will` maps to `user-will`.
- Raw source rows and raw stage values are retained in JSON/text metadata.
- Opportunity stage and lead/outreach status are separate. Canonical
  opportunity stages are `prospecting`, `discovery`, `site_visit`, `proposal`,
  `negotiation`, `won`, and `lost`. Legacy outreach states map conservatively
  into those stages; unknown states map to `prospecting`. The original value
  remains in `raw_legacy_stage` and `legacy_data`.
- Both `estimated_job_value` and `estimated_annual_value` remain null. The
  migration does not infer either one from legacy data.
- Company and opportunity ownership are both assigned from the legacy sales
  rep. Existing draft-backfilled rows with no company owner are safely repaired.
- Only known current services are linked; legacy `exterior_maintenance` maps to
  `other`.

JSON tasks and timeline events in `sales_workspace.state` are deferred. Their
shape and referential consistency can vary across saved workspace versions,
and importing them without per-record validation could either abort the
migration or create misleading activity history. A later application-aware
import can validate timestamps, types, and prospect references before
idempotently writing `sales_tasks` and `activities`.

Phase 1 task types include calls, emails, meetings, visits/site visits, quote
follow-ups, and custom/other work (plus legacy `quote`). Tasks support due,
reminder, completion, and cancellation timestamps. Structured activities
support the canonical email, phone, meeting, quote, job-completion, and
lost-opportunity events while retaining the earlier compatibility values.
Activities can record an actor, direction, outcome, source, body, and notes.

## Safety and rollback

The migration does not update or delete legacy rows, tables, or policies.
Reference seeds and backfill inserts use `ON CONFLICT DO NOTHING`, so existing
normalized records are not overwritten.

The migration also uses `ADD COLUMN IF NOT EXISTS`, named constraint checks,
and idempotent indexes so it can repair an accidentally applied earlier Phase 1
draft. Canonical stage seed rows are updated in place, and legacy-backed
opportunities are remapped to the corrected canonical opportunity stages.
If an earlier draft created the ambiguous `estimated_value` column, it is left
in place for additive safety but is not read, written, or indexed by this
version; new code must use the two explicit value columns.

If application verification fails, keep the legacy app pointed at
`sales_workspace` and `commercial_prospects`; it does not depend on the new
tables. The safest rollback is to leave the additive tables in place and fix
forward. If the normalized tables must be removed, first back them up, confirm
no normalized client is active, and drop only the new tables in reverse foreign
key order. Do not drop or alter the three legacy workspace/prospect tables or
their policies.

## Current app verification

Open the deployed site, log in with the PIN, and open **Sales**. The sidebar
should say **Cloud: Supabase**. Add/edit a prospect and verify it still appears
in `commercial_prospects`; the full Sales backup remains in `sales_workspace`
and shared HQ state remains in `blackboard_workspace`.
