-- The Gig Book: concert tickets, a fourth room of the Atlas.
--
-- Its own table for the same reason the Ticket Book has one: a gig has a
-- venue, doors, a section, a row and a seat, and none of those are columns
-- the Table Book or the Ticket Book have.
--
-- `starts` is a wall clock at the venue (timestamp, no zone), exactly as the
-- ticket prints it. An 8pm show in Chicago is at 8pm in Chicago whichever
-- zone she is reading it from. `doors` is a time of day on the same date.

create table public.gigs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    support text,
    venue text,
    city text,
    starts timestamp not null,
    doors time,
    section text,
    "row" text,
    seat text,
    tickets integer check (tickets is null or tickets > 0),
    cost numeric,
    currency text,
    seller text,
    ticket_link text,
    confirmation text,
    notes text,
    status text not null default 'booked'
        check (status in ('booked', 'went', 'cancelled', 'sold', 'missed')),
    source text default 'manual',
    placed_at timestamptz,
    placed_where text,
    created_at timestamptz not null default now()
);

create index gigs_user_starts_idx on public.gigs (user_id, starts desc);

alter table public.gigs enable row level security;
create policy "gigs are their owner's" on public.gigs
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A day item that came from the Gig Book points at it, as journeys do.
alter table public.atlas_day_items
    add column gig_id uuid references public.gigs (id) on delete set null;
