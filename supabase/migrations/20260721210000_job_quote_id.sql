-- Link field jobs back to the originating quote (Request → Quote → Job).
alter table public.field_jobs
  add column if not exists quote_id text not null default '';

create index if not exists field_jobs_quote_idx
  on public.field_jobs (quote_id)
  where archived_at is null and quote_id <> '';

comment on column public.field_jobs.quote_id is 'Stable QuoteDoc id when job was created from an approved quote';
