-- Requests OS: deepen intake without breaking existing status values.
-- Keep legacy status enum; add operational fields for follow-ups, value, property type.

alter table intake_requests
  add column if not exists follow_up_date date,
  add column if not exists follow_up_type text not null default '',
  add column if not exists follow_up_notes text not null default '',
  add column if not exists potential_value numeric,
  add column if not exists property_type text not null default ''
    check (property_type in ('', 'residential', 'commercial')),
  add column if not exists site_visit_outcome text not null default '',
  add column if not exists converted_quote_id text,
  add column if not exists linked_client_id text;

create index if not exists intake_requests_follow_up_idx
  on intake_requests (follow_up_date)
  where archived_at is null and follow_up_date is not null;

create index if not exists intake_requests_linked_client_idx
  on intake_requests (linked_client_id)
  where linked_client_id is not null;

comment on column intake_requests.follow_up_date is 'Next follow-up due date for Requests OS';
comment on column intake_requests.potential_value is 'Estimated pipeline value for this request';
comment on column intake_requests.linked_client_id is 'Optional existing WorkClient id before convert';
