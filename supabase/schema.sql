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

-- Shared HQ, Personal, and Work blackboard state
create table if not exists blackboard_workspace (
  id text primary key default 'default',
  state jsonb not null default '{"days":{}}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into blackboard_workspace (id, state)
values ('default', '{"days":{}}'::jsonb)
on conflict (id) do nothing;

alter table blackboard_workspace enable row level security;

drop policy if exists "blackboard_workspace_all" on blackboard_workspace;
create policy "blackboard_workspace_all"
  on blackboard_workspace for all
  using (true)
  with check (true);

-- Phase 1 normalized sales foundation. Server-side access requires
-- SUPABASE_SERVICE_ROLE_KEY; normalized tables intentionally have no policies.
create table if not exists sales_users (
  id text primary key, display_name text not null, email text,
  role text not null default 'sales_rep' check (role in ('sales_rep','sales_manager','admin')),
  is_active boolean not null default true, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), archived_at timestamptz,
  check (length(btrim(display_name)) > 0)
);
create unique index if not exists sales_users_email_unique on sales_users(lower(email)) where email is not null and btrim(email)<>'';
create index if not exists sales_users_active_idx on sales_users(is_active,archived_at);
create table if not exists companies (
  id text primary key, name text not null, assigned_user_id text references sales_users(id) on delete set null,
  industry text, website text, phone text,
  address_line1 text, address_line2 text, city text, state text, postal_code text,
  country text not null default 'US', notes text, legacy_prospect_id text unique,
  legacy_data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), archived_at timestamptz,
  check (length(btrim(name))>0), check (jsonb_typeof(legacy_data)='object')
);
alter table companies add column if not exists assigned_user_id text references sales_users(id) on delete set null;
create index if not exists companies_name_idx on companies(lower(name));
create index if not exists companies_assignee_idx on companies(assigned_user_id);
create index if not exists companies_city_idx on companies(lower(city));
create index if not exists companies_state_idx on companies(lower(state));
create index if not exists companies_created_at_idx on companies(created_at);
create index if not exists companies_archived_at_idx on companies(archived_at);
create table if not exists contacts (
  id text primary key, company_id text not null references companies(id) on delete restrict,
  full_name text not null, job_title text, email text, phone text, phone_ext text,
  contact_type text not null default 'other' check (contact_type in ('decision_maker','gatekeeper','other')),
  is_primary boolean not null default false, email_verified boolean not null default false,
  decision_maker_confirmed boolean not null default false, notes text,
  legacy_data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), archived_at timestamptz,
  check (length(btrim(full_name))>0), check (jsonb_typeof(legacy_data)='object')
);
create unique index if not exists contacts_one_primary_per_company on contacts(company_id) where is_primary and archived_at is null;
create index if not exists contacts_company_idx on contacts(company_id);
create index if not exists contacts_email_idx on contacts(lower(email));
create index if not exists contacts_type_idx on contacts(contact_type);
create index if not exists contacts_archived_at_idx on contacts(archived_at);
create table if not exists lead_sources (
  id text primary key, name text not null unique, description text,
  sort_order integer not null default 0 check(sort_order>=0), is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  archived_at timestamptz, check(length(btrim(name))>0)
);
create index if not exists lead_sources_active_idx on lead_sources(is_active,sort_order);
create table if not exists opportunity_stages (
  id text primary key, name text not null unique,
  probability numeric(5,2) not null default 0 check(probability>=0 and probability<=100),
  sort_order integer not null default 0 check(sort_order>=0), is_closed boolean not null default false,
  is_won boolean not null default false, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), archived_at timestamptz,
  check(length(btrim(name))>0), check(not is_won or is_closed)
);
create index if not exists opportunity_stages_order_idx on opportunity_stages(sort_order);
create index if not exists opportunity_stages_closed_idx on opportunity_stages(is_closed,is_won);
create table if not exists opportunities (
  id text primary key, company_id text not null references companies(id) on delete restrict,
  primary_contact_id text references contacts(id) on delete set null,
  stage_id text not null references opportunity_stages(id) on delete restrict,
  lead_source_id text references lead_sources(id) on delete set null,
  assigned_user_id text references sales_users(id) on delete set null, name text not null,
  lead_status text not null default 'not_contacted' check(lead_status in ('not_contacted','contacted','qualified','nurture','converted','lost')),
  priority text not null default 'medium' check(priority in ('low','medium','high')),
  estimated_job_value numeric(14,2) check(estimated_job_value is null or estimated_job_value>=0),
  estimated_annual_value numeric(14,2) check(estimated_annual_value is null or estimated_annual_value>=0),
  first_email_at timestamptz, first_call_at timestamptz, next_follow_up_at timestamptz,
  last_contact_at timestamptz, expected_close_at timestamptz, closed_at timestamptz,
  property_notes text, conversation_notes text, pain_points text, services_discussed text,
  raw_legacy_stage text, legacy_prospect_id text unique,
  legacy_data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), archived_at timestamptz,
  check(length(btrim(name))>0), check(jsonb_typeof(legacy_data)='object')
);
alter table opportunities add column if not exists estimated_job_value numeric(14,2) check(estimated_job_value is null or estimated_job_value>=0);
alter table opportunities add column if not exists estimated_annual_value numeric(14,2) check(estimated_annual_value is null or estimated_annual_value>=0);
create index if not exists opportunities_company_idx on opportunities(company_id);
create index if not exists opportunities_stage_idx on opportunities(stage_id);
create index if not exists opportunities_status_idx on opportunities(lead_status);
create index if not exists opportunities_priority_idx on opportunities(priority);
create index if not exists opportunities_assignee_idx on opportunities(assigned_user_id);
create index if not exists opportunities_source_idx on opportunities(lead_source_id);
create index if not exists opportunities_job_value_idx on opportunities(estimated_job_value);
create index if not exists opportunities_annual_value_idx on opportunities(estimated_annual_value);
create index if not exists opportunities_follow_up_idx on opportunities(next_follow_up_at);
create index if not exists opportunities_close_idx on opportunities(expected_close_at);
create index if not exists opportunities_created_at_idx on opportunities(created_at);
create index if not exists opportunities_archived_at_idx on opportunities(archived_at);
create table if not exists services (
  id text primary key, name text not null unique, description text, is_active boolean not null default true,
  sort_order integer not null default 0 check(sort_order>=0), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), archived_at timestamptz, check(length(btrim(name))>0)
);
create index if not exists services_active_idx on services(is_active,sort_order);
create table if not exists opportunity_services (
  opportunity_id text not null references opportunities(id) on delete cascade,
  service_id text not null references services(id) on delete restrict, notes text,
  created_at timestamptz not null default now(), primary key(opportunity_id,service_id)
);
create index if not exists opportunity_services_service_idx on opportunity_services(service_id);
create table if not exists activities (
  id text primary key, opportunity_id text references opportunities(id) on delete set null,
  company_id text references companies(id) on delete set null, contact_id text references contacts(id) on delete set null,
  assigned_user_id text references sales_users(id) on delete set null,
  actor_user_id text references sales_users(id) on delete set null, activity_type text not null,
  subject text not null, body text, notes text,
  direction text check(direction is null or direction in ('inbound','outbound','internal')),
  outcome text, source text, occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), archived_at timestamptz,
  check(opportunity_id is not null or company_id is not null or contact_id is not null),
  check(length(btrim(subject))>0), check(jsonb_typeof(metadata)='object')
);
alter table activities add column if not exists actor_user_id text references sales_users(id) on delete set null;
alter table activities add column if not exists notes text;
alter table activities add column if not exists direction text;
alter table activities add column if not exists outcome text;
alter table activities add column if not exists source text;
alter table activities drop constraint if exists activities_activity_type_check;
alter table activities drop constraint if exists activities_direction_check;
do $$
begin
  if not exists(select 1 from pg_constraint where conrelid='activities'::regclass and conname='activities_activity_type_phase1_check') then
    alter table activities add constraint activities_activity_type_phase1_check check(activity_type in('prospect_created','email_sent','email_opened','email_replied','phone_call','meeting_scheduled','quote_sent','quote_accepted','quote_declined','job_completed','lost_opportunity','note','research','email','call','voicemail','follow_up','meeting','site_visit','quote','stage_change','task_created','task_completed','attachment','other'));
  end if;
  if not exists(select 1 from pg_constraint where conrelid='activities'::regclass and conname='activities_direction_phase1_check') then
    alter table activities add constraint activities_direction_phase1_check check(direction is null or direction in('inbound','outbound','internal'));
  end if;
end $$;
create index if not exists activities_opportunity_idx on activities(opportunity_id);
create index if not exists activities_company_idx on activities(company_id);
create index if not exists activities_contact_idx on activities(contact_id);
create index if not exists activities_assignee_idx on activities(assigned_user_id);
create index if not exists activities_actor_idx on activities(actor_user_id);
create index if not exists activities_direction_idx on activities(direction);
create index if not exists activities_type_idx on activities(activity_type);
create index if not exists activities_occurred_at_idx on activities(occurred_at);
create index if not exists activities_archived_at_idx on activities(archived_at);
create table if not exists sales_tasks (
  id text primary key, opportunity_id text references opportunities(id) on delete set null,
  company_id text references companies(id) on delete set null, contact_id text references contacts(id) on delete set null,
  assigned_user_id text references sales_users(id) on delete set null, title text not null, description text,
  task_type text not null default 'other',
  status text not null default 'open' check(status in ('open','in_progress','completed','cancelled')),
  priority text not null default 'medium' check(priority in ('low','medium','high')),
  due_at timestamptz, remind_at timestamptz, completed_at timestamptz, canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
  check(opportunity_id is not null or company_id is not null or contact_id is not null),
  check(length(btrim(title))>0), check(status='completed' or completed_at is null), check(jsonb_typeof(metadata)='object')
);
alter table sales_tasks add column if not exists remind_at timestamptz;
alter table sales_tasks add column if not exists canceled_at timestamptz;
alter table sales_tasks drop constraint if exists sales_tasks_task_type_check;
do $$
begin
  if not exists(select 1 from pg_constraint where conrelid='sales_tasks'::regclass and conname='sales_tasks_task_type_phase1_check') then
    alter table sales_tasks add constraint sales_tasks_task_type_phase1_check check(task_type in('call','email','meeting','visit','site_visit','quote_follow_up','quote','custom','other'));
  end if;
end $$;
create index if not exists sales_tasks_opportunity_idx on sales_tasks(opportunity_id);
create index if not exists sales_tasks_company_idx on sales_tasks(company_id);
create index if not exists sales_tasks_assignee_idx on sales_tasks(assigned_user_id);
create index if not exists sales_tasks_status_idx on sales_tasks(status);
create index if not exists sales_tasks_priority_idx on sales_tasks(priority);
create index if not exists sales_tasks_due_at_idx on sales_tasks(due_at);
create index if not exists sales_tasks_remind_at_idx on sales_tasks(remind_at);
create index if not exists sales_tasks_open_due_idx on sales_tasks(due_at) where status in ('open','in_progress') and archived_at is null;
create table if not exists tags (
  id text primary key, name text not null, color text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), archived_at timestamptz,
  check(length(btrim(name))>0), check(color is null or color ~ '^#[0-9A-Fa-f]{6}$')
);
create unique index if not exists tags_name_unique on tags(lower(name)) where archived_at is null;
create table if not exists company_tags(company_id text not null references companies(id) on delete cascade,tag_id text not null references tags(id) on delete cascade,created_at timestamptz not null default now(),primary key(company_id,tag_id));
create index if not exists company_tags_tag_idx on company_tags(tag_id);
create table if not exists contact_tags(contact_id text not null references contacts(id) on delete cascade,tag_id text not null references tags(id) on delete cascade,created_at timestamptz not null default now(),primary key(contact_id,tag_id));
create index if not exists contact_tags_tag_idx on contact_tags(tag_id);
create table if not exists opportunity_tags(opportunity_id text not null references opportunities(id) on delete cascade,tag_id text not null references tags(id) on delete cascade,created_at timestamptz not null default now(),primary key(opportunity_id,tag_id));
create index if not exists opportunity_tags_tag_idx on opportunity_tags(tag_id);

insert into sales_users(id,display_name,role) values('user-will','Will','sales_rep') on conflict(id) do nothing;
insert into lead_sources(id,name,description,sort_order) values
('legacy-commercial-prospects','Legacy Commercial Prospects','Imported from commercial_prospects',0),('outbound','Outbound',null,10),('website','Website',null,20),('referral','Referral',null,30),('networking','Networking',null,40),('repeat-business','Repeat Business',null,50) on conflict(id) do nothing;
insert into opportunity_stages(id,name,probability,sort_order,is_closed,is_won) values
('prospecting','Prospecting',10,10,false,false),('discovery','Discovery',25,20,false,false),('site_visit','Site Visit',40,30,false,false),('proposal','Proposal',60,40,false,false),('negotiation','Negotiation',75,50,false,false),('won','Won',100,60,true,true),('lost','Lost',0,70,true,false)
on conflict(id) do update set name=excluded.name,probability=excluded.probability,sort_order=excluded.sort_order,is_closed=excluded.is_closed,is_won=excluded.is_won,updated_at=now();
insert into services(id,name,sort_order) values
('pressure_washing','Pressure Washing',10),('window_cleaning','Window Cleaning',20),('junk_removal','Junk Removal',30),('soft_washing','Soft Washing',40),('gutter_cleaning','Gutter Cleaning',50),('other','Other',60) on conflict(id) do nothing;

insert into sales_users(id,display_name,role)
select distinct case when lower(btrim(sales_rep))='will' then 'user-will' else 'legacy-user-'||md5(lower(btrim(sales_rep))) end,btrim(sales_rep),'sales_rep'
from commercial_prospects where btrim(sales_rep)<>'' on conflict(id) do nothing;
insert into companies(id,name,assigned_user_id,industry,website,phone,address_line1,city,legacy_prospect_id,legacy_data,created_at,updated_at)
select id,case when btrim(company_name)<>'' then company_name else 'Unnamed legacy company '||id end,case when btrim(sales_rep)='' or lower(btrim(sales_rep))='will' then 'user-will' else 'legacy-user-'||md5(lower(btrim(sales_rep))) end,nullif(btrim(industry),''),nullif(btrim(website),''),nullif(btrim(company_phone),''),nullif(btrim(address),''),nullif(btrim(city),''),id,to_jsonb(commercial_prospects),created_at,updated_at from commercial_prospects on conflict(id) do nothing;
insert into contacts(id,company_id,full_name,job_title,email,phone,phone_ext,contact_type,is_primary,email_verified,decision_maker_confirmed,legacy_data,created_at,updated_at)
select id||':primary',id,decision_maker,nullif(btrim(job_title),''),nullif(btrim(email),''),nullif(btrim(phone),''),nullif(btrim(phone_ext),''),'decision_maker',true,email_verified,decision_maker_confirmed,jsonb_build_object('legacy_prospect_id',id,'legacy_role','decision_maker'),created_at,updated_at from commercial_prospects where btrim(decision_maker)<>'' on conflict(id) do nothing;
insert into contacts(id,company_id,full_name,phone,contact_type,is_primary,legacy_data,created_at,updated_at)
select id||':assistant',id,assistant_name,nullif(btrim(assistant_phone),''),'gatekeeper',false,jsonb_build_object('legacy_prospect_id',id,'legacy_role','assistant'),created_at,updated_at from commercial_prospects where btrim(assistant_name)<>'' on conflict(id) do nothing;
insert into opportunities(id,company_id,primary_contact_id,stage_id,lead_source_id,assigned_user_id,name,lead_status,priority,estimated_job_value,estimated_annual_value,first_email_at,first_call_at,next_follow_up_at,last_contact_at,property_notes,conversation_notes,pain_points,services_discussed,raw_legacy_stage,legacy_prospect_id,legacy_data,created_at,updated_at)
select id,id,case when btrim(decision_maker)<>'' then id||':primary' end,
case lead_status when 'spoke_with_dm' then 'discovery' when 'interested' then 'discovery' when 'meeting_scheduled' then 'site_visit' when 'site_visit' then 'site_visit' when 'site_visit_scheduled' then 'site_visit' when 'quote_sent' then 'proposal' when 'proposal_sent' then 'proposal' when 'negotiating' then 'negotiation' when 'won' then 'won' when 'lost' then 'lost' else 'prospecting' end,
'legacy-commercial-prospects',case when btrim(sales_rep)='' or lower(btrim(sales_rep))='will' then 'user-will' else 'legacy-user-'||md5(lower(btrim(sales_rep))) end,
case when btrim(company_name)<>'' then company_name||' opportunity' else 'Legacy opportunity '||id end,
case when lead_status='won' then 'converted' when lead_status='lost' then 'lost' when lead_status='future_opportunity' then 'nurture' when lead_status in('spoke_with_dm','interested','negotiating','meeting_scheduled','site_visit','site_visit_scheduled','quote_sent','proposal_sent') then 'qualified' when lead_status in('email_sent','follow_up_1','follow_up_2','follow_up_due','called','left_voicemail') then 'contacted' else 'not_contacted' end,
case lower(priority) when 'high' then 'high' when 'low' then 'low' else 'medium' end,null,null,first_email_at,first_call_at,next_follow_up_at,last_contact_at,nullif(btrim(property_notes),''),nullif(btrim(conversation_notes),''),nullif(btrim(pain_points),''),nullif(btrim(services_discussed),''),lead_status,id,to_jsonb(commercial_prospects),created_at,updated_at from commercial_prospects on conflict(id) do nothing;
update companies c set assigned_user_id=case when btrim(cp.sales_rep)='' or lower(btrim(cp.sales_rep))='will' then 'user-will' else 'legacy-user-'||md5(lower(btrim(cp.sales_rep))) end from commercial_prospects cp where c.legacy_prospect_id=cp.id and c.assigned_user_id is null;
update opportunities o set stage_id=case cp.lead_status when 'spoke_with_dm' then 'discovery' when 'interested' then 'discovery' when 'meeting_scheduled' then 'site_visit' when 'site_visit' then 'site_visit' when 'site_visit_scheduled' then 'site_visit' when 'quote_sent' then 'proposal' when 'proposal_sent' then 'proposal' when 'negotiating' then 'negotiation' when 'won' then 'won' when 'lost' then 'lost' else 'prospecting' end from commercial_prospects cp where o.legacy_prospect_id=cp.id;
insert into opportunity_services(opportunity_id,service_id)
select distinct cp.id,case service_name when 'exterior_maintenance' then 'other' else service_name end from commercial_prospects cp cross join lateral unnest(cp.services_needed) as service_row(service_name) where service_name in('pressure_washing','window_cleaning','junk_removal','soft_washing','gutter_cleaning','other','exterior_maintenance') on conflict(opportunity_id,service_id) do nothing;

alter table sales_users enable row level security;
alter table companies enable row level security;
alter table contacts enable row level security;
alter table lead_sources enable row level security;
alter table opportunity_stages enable row level security;
alter table opportunities enable row level security;
alter table services enable row level security;
alter table opportunity_services enable row level security;
alter table activities enable row level security;
alter table sales_tasks enable row level security;
alter table tags enable row level security;
alter table company_tags enable row level security;
alter table contact_tags enable row level security;
alter table opportunity_tags enable row level security;
