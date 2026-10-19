-- Someone can be paying for someone else: Dad covers everything for Geeta,
-- Sanika and Glenn; Neha covers Nadia's hotels but not her flights.
-- [{"person": "Nadia", "payer": "Neha", "buckets": ["lodging"]}, ...]
-- buckets: "all", or any of lodging / transport / food / excursions.
alter table public.atlas_trips add column if not exists cover_rules jsonb not null default '[]'::jsonb;
