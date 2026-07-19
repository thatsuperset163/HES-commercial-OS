-- Limit active catalog services to the three HES offers.
-- Keeps legacy rows for historical opportunity_services FKs.

update public.services
set
  is_active = false,
  updated_at = timezone('utc', now())
where id in ('soft_washing', 'gutter_cleaning', 'other');

update public.services
set
  is_active = true,
  updated_at = timezone('utc', now())
where id in ('pressure_washing', 'window_cleaning', 'junk_removal');
