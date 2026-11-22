-- The Repertoire: every dance she has choreographed.
--
-- One row is one set: a tutorial video made for one group at one event
-- ("Malvika + Nitin Wedding", "Friends"). The songs are not columns of their
-- own — `chapters` holds the YouTube chapter list exactly as she writes it in
-- the description, and the app reads the songs out of it (src/utils/dances.js).
-- One source, so the description and the portal cannot disagree.

create table public.dance_sets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    event text not null,
    group_name text,
    performed_on date,
    video_url text,
    chapters text not null default '',
    notes text,
    created_at timestamptz not null default now()
);

create index dance_sets_user_date_idx on public.dance_sets (user_id, performed_on desc);

alter table public.dance_sets enable row level security;
create policy "dance sets are their owner's" on public.dance_sets
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
