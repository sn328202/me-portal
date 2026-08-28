-- from_plan_id was declared bigint. day_plans.id is a uuid.
--
-- So every sync failed at the first query: PostgREST sent a uuid string to a
-- bigint column, Postgres refused it, and the catch turned that into a line
-- saying the trip day could not be updated. The itinerary saved; the trip
-- never moved. Exactly the symptom — "I changed the title and the Atlas still
-- shows the old one".
--
-- The column was empty (nothing could ever be written to it), so the type is
-- simply corrected, and a foreign key now makes the same mistake impossible.
drop index if exists atlas_day_items_from_plan_idx;

alter table public.atlas_day_items
    drop column if exists from_plan_id;

alter table public.atlas_day_items
    add column from_plan_id uuid references public.day_plans(id) on delete set null;

comment on column public.atlas_day_items.from_plan_id is
    'The day_plans row this item was copied from. Null means it was made in the Atlas and is never overwritten by a re-sync.';

create index if not exists atlas_day_items_from_plan_idx
    on public.atlas_day_items (from_plan_id, day_id);
