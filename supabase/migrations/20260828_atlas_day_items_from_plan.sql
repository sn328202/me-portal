-- Which itinerary an Atlas day item came from.
--
-- Sending a day plan into a trip copied its cards across and then forgot it
-- had. Change the itinerary afterwards and the only way to get the change
-- across was to send again, which appended a second copy of everything — the
-- dialog said so, which is an apology rather than a fix.
--
-- With provenance, a re-send can replace exactly the rows it put there last
-- time and leave everything she added in the Atlas itself alone. Null means
-- "made here", and nothing automatic ever touches those.
alter table public.atlas_day_items
    add column if not exists from_plan_id bigint;

comment on column public.atlas_day_items.from_plan_id is
    'The day_plans row this item was copied from. Null means it was made in the Atlas and is never overwritten by a re-sync.';

-- The sync deletes by (day, plan) on every save of a linked itinerary.
create index if not exists atlas_day_items_from_plan_idx
    on public.atlas_day_items (from_plan_id, day_id);
