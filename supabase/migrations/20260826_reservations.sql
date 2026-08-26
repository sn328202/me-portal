-- Restaurant reservations: the table you actually hold, as opposed to the
-- place you merely want to go (that is `spots`).
--
-- `spot_id` is the join between wanting and going. A reservation booked from
-- the spots library keeps the link, so marking the meal eaten can flip the
-- spot to 'been' without her telling the app the same thing twice.
create table if not exists public.reservations (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references auth.users(id),
    spot_id       uuid references public.spots(id) on delete set null,

    restaurant    text not null,
    starts_at     timestamptz not null,
    party_size    integer,
    seating       text,          -- 'chef''s counter', 'outdoor', 'dining room'

    city          text,
    address       text,
    phone         text,

    platform      text,          -- OpenTable, Resy, Tock, Yelp, Google...
    confirmation  text,

    -- booked | dined | cancelled | no_show
    status        text not null default 'booked',

    -- The deadline worth knowing about, and what it costs to miss it.
    cancel_by     timestamptz,
    cancel_fee    text,

    notes         text,
    source        text default 'manual',   -- manual | email
    created_at    timestamptz not null default now()
);

-- Every read is "this diner's bookings, soonest first" or the same list
-- reversed for history, so one index serves both.
create index if not exists reservations_user_starts_idx
    on public.reservations (user_id, starts_at desc);

create index if not exists reservations_spot_idx
    on public.reservations (spot_id) where spot_id is not null;

alter table public.reservations enable row level security;

drop policy if exists "Users can manage their own reservations" on public.reservations;
create policy "Users can manage their own reservations"
    on public.reservations for all to authenticated
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
