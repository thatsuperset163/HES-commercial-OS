-- Field jobs calendar (Jobs OS scheduling) — durable cloud source of truth.
-- Service-role access only (RLS on, no anon policies) — matches Requests Center.

create table if not exists public.field_jobs (
  id text primary key,
  customer_id text not null default '',
  request_id text not null default '',
  prospect_id text not null default '',
  customer_name text not null default 'Customer',
  company_name text not null default '',
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  service_address text not null default '',
  service_type text not null default 'Pressure Washing',
  title text not null default '',
  description text not null default '',
  scheduled_date date,
  start_time text,
  end_time text,
  estimated_duration_minutes integer not null default 60,
  estimated_revenue numeric(12, 2) not null default 0,
  assigned_to text not null default '',
  status text not null default 'unscheduled'
    check (status in (
      'unscheduled',
      'scheduled',
      'confirmed',
      'en_route',
      'in_progress',
      'completed',
      'cancelled'
    )),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  internal_notes text not null default '',
  customer_notes text not null default '',
  equipment_needed text not null default '',
  invoice_status text not null default 'none'
    check (invoice_status in ('none', 'draft', 'sent', 'paid', 'void')),
  payment_status text not null default 'na'
    check (payment_status in ('na', 'unpaid', 'partial', 'paid')),
  recurring_rule text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  check (length(btrim(customer_name)) > 0)
);

create index if not exists field_jobs_scheduled_idx
  on public.field_jobs (scheduled_date)
  where archived_at is null;

create index if not exists field_jobs_status_idx
  on public.field_jobs (status)
  where archived_at is null;

create index if not exists field_jobs_updated_idx
  on public.field_jobs (updated_at desc);

alter table public.field_jobs enable row level security;

grant all on table public.field_jobs to service_role;
