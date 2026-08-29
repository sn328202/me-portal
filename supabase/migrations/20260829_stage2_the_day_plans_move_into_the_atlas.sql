-- Stage 2: the day plans move in.
--
-- Six of the eight plans cross. The other two — "Saturday w/ Will" and "Napa
-- Day w/ Will" — were already sent to the Atlas and their eight items already
-- live on days in an existing trip. Copying those again would create exactly
-- the duplicate this whole merge exists to remove, so they are skipped: they
-- are already here.
--
-- Nothing is deleted. day_plans and plan_items are untouched and the Daydream
-- keeps working off them. Everything written here is stamped with from_plan_id,
-- so the whole stage undoes with three deletes:
--
--   delete from atlas_ideas     where from_plan_id is not null;
--   delete from atlas_day_items where from_plan_id in (select id from day_plans);
--   delete from atlas_trips     where from_plan_id is not null;   -- days cascade

-- 1. Each plan becomes a trip. A dated plan is a trip one day long — which is
--    the entire idea this merge rests on.
insert into public.atlas_trips (destination, start_date, end_date, notes, status, user_id, from_plan_id)
select btrim(p.title), p.planned_date, p.planned_date, nullif(btrim(coalesce(p.notes, '')), ''), 'Planned', p.user_id, p.id
from public.day_plans p
where p.atlas_day_id is null
  and not exists (select 1 from public.atlas_trips t where t.from_plan_id = p.id);

-- 2. A dated plan gets its one day. An undated one gets none — there is no
--    date to hang it on, and inventing one would be a lie in a calendar.
insert into public.atlas_days (trip_id, date, city, user_id)
select t.id, p.planned_date, nullif(btrim(coalesce(p.location, '')), ''), p.user_id
from public.day_plans p
join public.atlas_trips t on t.from_plan_id = p.id
where p.planned_date is not null
  and not exists (select 1 from public.atlas_days d where d.trip_id = t.id and d.date = p.planned_date);

-- 3. The items of a dated plan become that day's stops.
--
--    sort_order is not usable as an order: all four Ferry Building items are
--    sort_order 0. The clock is the real order, so it is renumbered from the
--    clock, falling back to sort_order and then to when it was typed.
insert into public.atlas_day_items (
    day_id, title, start_time, end_time, location, link, notes,
    cost, cost_shared, icon, travel_note, place_id, place_data, spot_id,
    sort_order, from_plan_id, user_id
)
select
    d.id,
    btrim(i.activity),
    i.start_time,
    case when i.duration is not null and i.start_time is not null
         then (i.start_time + i.duration)::time end,
    nullif(btrim(coalesce(i.location, '')), ''),
    nullif(btrim(coalesce(i.link, '')), ''),
    nullif(btrim(coalesce(i.notes, '')), ''),
    case when btrim(coalesce(i.cost, '')) ~ '^[0-9]+(\.[0-9]+)?$' then i.cost::numeric end,
    coalesce(i.cost_shared, true),
    i.icon,
    nullif(btrim(coalesce(i.travel_note, '')), ''),
    i.place_id,
    i.place_data,
    i.spot_id,
    (row_number() over (partition by i.plan_id order by i.start_time nulls last, i.sort_order, i.created_at))::int - 1,
    i.plan_id,
    i.user_id
from public.plan_items i
join public.day_plans p on p.id = i.plan_id
join public.atlas_trips t on t.from_plan_id = p.id
join public.atlas_days d on d.trip_id = t.id and d.date = p.planned_date
where p.planned_date is not null
  and coalesce(i.is_brainstorm, false) = false
  and not exists (
      select 1 from public.atlas_day_items x
      where x.day_id = d.id and x.from_plan_id = i.plan_id
  );

-- 4. The items of an undated plan become that trip's ideas.
--
--    An undated plan IS a board of things you want to do, in an order, with a
--    rough hour attached. All three of those survive: the order in sort_order,
--    the hour in the start_time added a moment ago.
insert into public.atlas_ideas (
    trip_id, kind, title, notes, url, cost, area, start_time,
    sort_order, from_plan_id, user_id
)
select
    t.id,
    'do',
    btrim(i.activity),
    nullif(btrim(coalesce(i.notes, '')), ''),
    nullif(btrim(coalesce(i.link, '')), ''),
    case when btrim(coalesce(i.cost, '')) ~ '^[0-9]+(\.[0-9]+)?$' then i.cost::numeric end,
    nullif(btrim(coalesce(i.location, '')), ''),
    i.start_time,
    (row_number() over (partition by i.plan_id order by i.sort_order, i.start_time nulls last, i.created_at))::int - 1,
    i.plan_id,
    i.user_id
from public.plan_items i
join public.day_plans p on p.id = i.plan_id
join public.atlas_trips t on t.from_plan_id = p.id
where p.planned_date is null
  and not exists (
      select 1 from public.atlas_ideas x where x.from_plan_id = i.plan_id
  );
