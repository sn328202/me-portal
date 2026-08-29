-- The Wardrobe is a self-contained HTML app in an iframe. Its whole state has
-- lived in one browser's localStorage since the day it was embedded: a closet
-- of about forty items, the packing essentials, the trips, the per-person
-- profiles. Clear that browser's site data and it is gone, with no copy
-- anywhere.
--
-- Rather than rewrite eighty kilobytes of working planner, this gives its six
-- storage keys a home. The planner still reads and writes localStorage exactly
-- as it always has; the portal mirrors those keys here.

create table if not exists public.wardrobe_state (
    user_id     uuid not null references auth.users(id) on delete cascade,
    key         text not null,
    value       jsonb not null,
    updated_at  timestamptz not null default now(),
    primary key (user_id, key)
);

comment on table public.wardrobe_state is
    'Mirror of the outfit planner''s op_* localStorage keys, one row per key per person.';

alter table public.wardrobe_state enable row level security;

drop policy if exists "wardrobe_state is hers alone" on public.wardrobe_state;
create policy "wardrobe_state is hers alone"
    on public.wardrobe_state
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
