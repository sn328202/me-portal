-- Who paid what, and costs in other currencies.
--
-- A cost keeps the amount and currency it was charged in. `fx_rate` is USD per
-- one unit of that currency; the USD figure is always cost * fx_rate, so it can
-- never go stale when the amount is edited. Typing a USD figure by hand stores
-- the rate it implies and sets fx_manual. A null or 'USD' currency is USD.

alter table public.atlas_day_items add column if not exists currency text;
alter table public.atlas_day_items add column if not exists fx_rate numeric;
alter table public.atlas_day_items add column if not exists fx_manual boolean not null default false;

alter table public.atlas_stays add column if not exists fx_rate numeric;
alter table public.atlas_stays add column if not exists fx_manual boolean not null default false;

-- Who is on the trip. Names, in the order she adds them.
alter table public.atlas_trips add column if not exists travelers text[] not null default '{}';

-- Who paid for one cost, and whose share it is. One row per cost.
-- paid: [{"name": "Neha", "usd": 120.5}, ...]
-- owed: null means split equally among every traveler on the trip;
--       otherwise [{"name": "Neha", "usd": 60}, ...]
create table public.cost_splits (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    trip_id bigint not null references public.atlas_trips (id) on delete cascade,
    source text not null check (source in ('item', 'stay')),
    source_id text not null,
    paid jsonb not null default '[]'::jsonb,
    owed jsonb,
    updated_at timestamptz not null default now(),
    unique (source, source_id)
);

create index cost_splits_trip_idx on public.cost_splits (trip_id);

alter table public.cost_splits enable row level security;
create policy "cost splits are their owner's" on public.cost_splits
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
