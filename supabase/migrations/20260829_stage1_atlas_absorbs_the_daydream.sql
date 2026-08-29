-- Stage 1 of merging the Daydream into the Atlas. Additive only: nothing the
-- running app reads or writes changes meaning, so this can sit in production
-- indefinitely before Stage 2, and can be reversed by dropping what it adds.

-- 1. Everything a plan_item can carry that an atlas_day_item cannot.
--
-- These are not incidental fields. `icon` is the emoji that makes a long day
-- skimmable; `travel_note` is the drive time she types when Google cannot
-- work it out; `place_id`/`place_data` are what a Google-picked place brings
-- with it — the rating, the address, the photo.
alter table public.atlas_day_items
    add column if not exists icon text,
    add column if not exists travel_note text,
    add column if not exists place_id text,
    add column if not exists place_data jsonb;

comment on column public.atlas_day_items.icon is
    'One emoji, chosen by the user. Null means the app guesses from the title.';
comment on column public.atlas_day_items.travel_note is
    'How long to the next stop, typed by hand when it cannot be looked up.';

-- 2. A day points at a booking; it never copies one.
--
-- A booking has a date, a time and a place, and so does a day item — so
-- copying one onto a day would rebuild exactly the two-copies problem this
-- whole migration exists to remove. The day reads the booking through this,
-- which is why changing a booking changes what the day shows: there is only
-- one of it.
--
-- This replaces the `booked` boolean, which could say that something was
-- booked but never which booking it was. That column stays for now and is
-- dropped in Stage 5.
alter table public.atlas_day_items
    add column if not exists booked_id uuid
        references public.reservations(id) on delete set null;

comment on column public.atlas_day_items.booked_id is
    'The reservation this stop is. The day shows the booking''s name, time and confirmation by reading them — never by copying them.';

create index if not exists atlas_day_items_booked_idx
    on public.atlas_day_items (booked_id) where booked_id is not null;

-- 3. An idea can exist before it belongs to a trip.
--
-- A place sent to the portal rarely knows which trip it is for — often there
-- is no trip yet. Null means "anywhere", and shows on every trip's ideas
-- board under its own heading. RLS on this table is user_id-based, so an
-- unassigned idea stays visible to its owner.
alter table public.atlas_ideas
    alter column trip_id drop not null;

comment on column public.atlas_ideas.trip_id is
    'The trip this idea is for. Null means it is not assigned to one yet.';

-- 4. A booking is not always a table.
--
-- The Table Book is becoming where every booking lives — a tasting, a show, a
-- paragliding slot — so a booking needs to say which kind it is. All 78
-- currently in there were booked as tables.
alter table public.reservations
    add column if not exists kind text;

update public.reservations set kind = 'table' where kind is null;

alter table public.reservations
    alter column kind set default 'table';

comment on column public.reservations.kind is
    'table | tasting | activity | show | transport | stay';

-- 5. Trip dates become dates.
--
-- They have always been text, which is why "0002-08-29" could be stored at
-- all: nothing in the database was in a position to object. Every value
-- currently stored is either null or a well-formed ISO date, checked before
-- running this, so the cast cannot lose anything.
--
-- PostgREST renders a date column as the same "YYYY-MM-DD" string the app
-- already reads, and DateField already sends exactly that or null, so no
-- application code changes meaning.
update public.atlas_trips set start_date = null where start_date = '';
update public.atlas_trips set end_date = null where end_date = '';

alter table public.atlas_trips
    alter column start_date type date using start_date::date,
    alter column end_date type date using end_date::date;
