-- A boolean could only say booked or not booked, and "not booked" was doing
-- two jobs at once: a walk in the park that will never need booking, and a
-- restaurant she has not rung yet. Those are opposite situations — one is
-- finished and one is a task — and the card looked the same for both.
--
--   none    doesn't need booking          (the default: most things)
--   todo    needs booking, not done yet   (the one worth shouting about)
--   booked  held                          (the default from the Table Book)

alter table public.atlas_day_items
    add column if not exists booking text not null default 'none';

-- Carry the boolean across. A stop pointing at a reservation is booked
-- whatever the flag said.
update public.atlas_day_items
   set booking = case when booked or booked_id is not null then 'booked' else 'none' end
 where booking = 'none';

alter table public.atlas_day_items
    drop constraint if exists atlas_day_items_booking_known;

alter table public.atlas_day_items
    add constraint atlas_day_items_booking_known
    check (booking in ('none', 'todo', 'booked'));

comment on column public.atlas_day_items.booking is
    'none | todo | booked. Replaces the `booked` boolean, which Stage 5 drops.';
