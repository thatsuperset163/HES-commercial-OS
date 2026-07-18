-- Requests Center: intake pipeline before a job exists.
-- Service-role access only (RLS on, no anon policies).

create table if not exists intake_requests (
  id text primary key,
  status text not null default 'new'
    check (status in (
      'new',
      'needs_response',
      'estimate_scheduled',
      'waiting_on_customer',
      'approved',
      'declined'
    )),
  customer_name text not null,
  company text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  service_requested text not null default '',
  request_source text not null default 'manual',
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  notes text not null default '',
  date_received date not null default (timezone('utc', now()))::date,
  estimate_date date,
  estimate_time text not null default '',
  assigned_person text not null default '',
  directions text not null default '',
  estimate_notes text not null default '',
  waiting_reason text not null default '',
  decline_reason text not null default '',
  decline_notes text not null default '',
  converted_client_id text,
  converted_job_id text,
  converted_invoice_id text,
  ai_summary text not null default '',
  ai_suggested_reply text not null default '',
  ai_price_estimate text not null default '',
  ai_upsell_suggestions text not null default '',
  internal_notes text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (length(btrim(customer_name)) > 0),
  check (jsonb_typeof(attachments) = 'array'),
  check (jsonb_typeof(photos) = 'array')
);

create index if not exists intake_requests_status_idx
  on intake_requests (status, updated_at desc);
create index if not exists intake_requests_received_idx
  on intake_requests (date_received desc);

create table if not exists intake_request_activities (
  id text primary key,
  request_id text not null references intake_requests(id) on delete cascade,
  activity_type text not null,
  body text not null default '',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (length(btrim(activity_type)) > 0),
  check (jsonb_typeof(meta) = 'object')
);

create index if not exists intake_request_activities_request_idx
  on intake_request_activities (request_id, created_at desc);

alter table intake_requests enable row level security;
alter table intake_request_activities enable row level security;
