-- Voice capture log: every spoken thought, what it became, and how to undo it.
create table if not exists public.captures (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references auth.users(id),
    transcript   text not null,
    summary      text,
    actions      jsonb not null default '[]'::jsonb,  -- [{tool, table, id, label}]
    undone       boolean not null default false,
    source       text default 'shortcut',
    model        text,
    error        text,
    created_at   timestamptz not null default now()
);

create index if not exists captures_user_created_idx
    on public.captures (user_id, created_at desc);

alter table public.captures enable row level security;

drop policy if exists "Users can manage their own captures" on public.captures;
create policy "Users can manage their own captures"
    on public.captures for all to authenticated
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
