-- Stage 2 needs three things the Atlas does not have yet. All additive.
--
-- 1 & 2. Provenance, so the copy can be re-run without duplicating and undone
--        with one delete. These are the columns Stage 5 drops along with
--        day_plans; until then they are what makes this stage reversible.
alter table public.atlas_trips
    add column if not exists from_plan_id uuid;

alter table public.atlas_ideas
    add column if not exists from_plan_id uuid;

create index if not exists atlas_trips_from_plan_idx
    on public.atlas_trips (from_plan_id) where from_plan_id is not null;

create index if not exists atlas_ideas_from_plan_idx
    on public.atlas_ideas (from_plan_id) where from_plan_id is not null;

-- 3. A time on an idea.
--
--    The plan assumed undated day plans would become trips with no dates and
--    no day, their items landing on the ideas board. That is right — an
--    undated plan IS a board of ideas. But all eight of those items carry a
--    start_time, and one of them is an ordered morning: 9, 10, 11. The ideas
--    board had nowhere to put that, and the promise was that nothing gets
--    silently dropped.
--
--    So an idea may know roughly when it wants to happen. It also means that
--    later, when an idea is dragged onto a day, it already knows its hour.
alter table public.atlas_ideas
    add column if not exists start_time time without time zone;

comment on column public.atlas_ideas.start_time is
    'Roughly when this wants to happen, if it already knows. Carried over from undated day plans.';
