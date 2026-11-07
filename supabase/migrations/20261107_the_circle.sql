-- The Circle: the people in her life, and how they fit into it.
--
-- Contacts already hold names and numbers. This holds what Contacts doesn't:
-- what they like, what to get them, when she last actually saw or spoke to
-- them, who they are to each other, and which crowd they belong to.
--
-- A birthday is a month and a day, with the year optional. Most of the
-- birthdays she has came from Outlook reminders, which know the day and not
-- the year, and an age is a thing you often don't know about a friend.

create table public.people (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    nickname text,
    -- Who they are to her: "college roommate", "dad", "Adeesh's cousin".
    relation text,
    birthday_month smallint check (birthday_month between 1 and 12),
    birthday_day smallint check (birthday_day between 1 and 31),
    birth_year smallint check (birth_year between 1900 and 2100),
    phone text,
    email text,
    address text,
    city text,
    how_we_met text,
    likes text[] not null default '{}',
    dislikes text[] not null default '{}',
    notes text,
    -- How often she'd like to be in touch, in days. Null means no nudge.
    touch_every_days integer check (touch_every_days is null or touch_every_days > 0),
    source text not null default 'manual',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check ((birthday_month is null) = (birthday_day is null))
);
create index people_user_idx on public.people (user_id, name);

-- Times they actually connected. "Last in touch" is the latest of these, so
-- a weekly roundup can add rows without ever overwriting what she typed.
create table public.person_touchpoints (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    person_id uuid not null references public.people (id) on delete cascade,
    happened_on date not null default current_date,
    kind text not null default 'in_person'
        check (kind in ('in_person', 'call', 'video', 'text', 'other')),
    note text,
    source text not null default 'manual',
    -- Lets a roundup re-run without adding the same call twice.
    source_ref text,
    created_at timestamptz not null default now()
);
create index person_touchpoints_person_idx on public.person_touchpoints (person_id, happened_on desc);
create unique index person_touchpoints_source_ref_idx
    on public.person_touchpoints (user_id, source, source_ref) where source_ref is not null;

create table public.person_gift_ideas (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    person_id uuid not null references public.people (id) on delete cascade,
    idea text not null,
    link text,
    status text not null default 'idea' check (status in ('idea', 'bought', 'given')),
    occasion text,
    given_on date,
    created_at timestamptz not null default now()
);
create index person_gift_ideas_person_idx on public.person_gift_ideas (person_id);

-- How two people are related to each other. Stored once; read from both ends.
-- `label` is what person_b is to person_a ("sister"); `reverse_label` is what
-- person_a is to person_b ("sibling"). Null reverse_label means the same word
-- both ways ("friend", "cousin").
create table public.person_links (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    person_a uuid not null references public.people (id) on delete cascade,
    person_b uuid not null references public.people (id) on delete cascade,
    label text not null,
    reverse_label text,
    created_at timestamptz not null default now(),
    check (person_a <> person_b)
);
create index person_links_a_idx on public.person_links (person_a);
create index person_links_b_idx on public.person_links (person_b);

create table public.people_groups (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    emoji text,
    notes text,
    created_at timestamptz not null default now(),
    unique (user_id, name)
);

create table public.people_group_members (
    user_id uuid not null references auth.users (id) on delete cascade,
    group_id uuid not null references public.people_groups (id) on delete cascade,
    person_id uuid not null references public.people (id) on delete cascade,
    primary key (group_id, person_id)
);
create index people_group_members_person_idx on public.people_group_members (person_id);

alter table public.people enable row level security;
alter table public.person_touchpoints enable row level security;
alter table public.person_gift_ideas enable row level security;
alter table public.person_links enable row level security;
alter table public.people_groups enable row level security;
alter table public.people_group_members enable row level security;

create policy "people are their owner's" on public.people
    for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "touchpoints are their owner's" on public.person_touchpoints
    for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "gift ideas are their owner's" on public.person_gift_ideas
    for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "person links are their owner's" on public.person_links
    for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "people groups are their owner's" on public.people_groups
    for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "group members are their owner's" on public.people_group_members
    for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.people_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
    new.updated_at := now();
    return new;
end;
$$;
create trigger people_updated_at before update on public.people
    for each row execute function public.people_touch_updated_at();
