-- Harris Exteriors HQ — Commercial Sales OS
-- Run this once in Supabase → SQL Editor → New query → Run

-- Full app state (source of truth for the Sales OS)
create table if not exists sales_workspace (
  id text primary key default 'default',
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into sales_workspace (id, state)
values ('default', '{"prospects":[],"tasks":[],"timeline":[],"templates":[],"sentEmails":[],"attachments":[]}'::jsonb)
on conflict (id) do nothing;

-- Flat prospects table for easy browsing in Table Editor
create table if not exists commercial_prospects (
  id text primary key,
  company_name text not null default '',
  industry text not null default '',
  website text not null default '',
  company_phone text not null default '',
  address text not null default '',
  city text not null default '',
  decision_maker text not null default '',
  job_title text not null default '',
  email text not null default '',
  phone text not null default '',
  phone_ext text not null default '',
  assistant_name text not null default '',
  assistant_phone text not null default '',
  lead_status text not null default 'not_contacted',
  priority text not null default 'medium',
  first_email_at timestamptz,
  first_call_at timestamptz,
  next_follow_up_at timestamptz,
  last_contact_at timestamptz,
  property_notes text not null default '',
  conversation_notes text not null default '',
  pain_points text not null default '',
  services_discussed text not null default '',
  services_needed text[] not null default '{}',
  email_verified boolean not null default false,
  decision_maker_confirmed boolean not null default false,
  sales_rep text not null default 'Will',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PIN-gated site uses the anon key from the browser via Next API.
-- Keep the site private (PIN). Tighten RLS later if you add real user auth.
alter table sales_workspace enable row level security;
alter table commercial_prospects enable row level security;

drop policy if exists "sales_workspace_all" on sales_workspace;
create policy "sales_workspace_all"
  on sales_workspace for all
  using (true)
  with check (true);

drop policy if exists "commercial_prospects_all" on commercial_prospects;
create policy "commercial_prospects_all"
  on commercial_prospects for all
  using (true)
  with check (true);
