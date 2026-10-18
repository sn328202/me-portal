-- Hotels are bookings too. A hotel booked before its trip exists in the Atlas
-- is kept with no trip, and attaches itself to the trip whose dates cover its
-- check-in when that trip is opened (see useTripDays).
--
-- And deleting a trip no longer deletes the hotels booked for it: the booking
-- is still real, it just goes back to waiting.

alter table public.atlas_stays alter column trip_id drop not null;

alter table public.atlas_stays drop constraint atlas_stays_trip_id_fkey;
alter table public.atlas_stays add constraint atlas_stays_trip_id_fkey
    foreign key (trip_id) references public.atlas_trips (id) on delete set null;

alter table public.atlas_stays alter column cost set default 0;
alter table public.atlas_stays alter column cost_shared set default true;
alter table public.atlas_stays add column if not exists currency text;
alter table public.atlas_stays add column if not exists source text default 'manual';

create index if not exists atlas_stays_waiting_idx
    on public.atlas_stays (user_id, check_in) where trip_id is null;
