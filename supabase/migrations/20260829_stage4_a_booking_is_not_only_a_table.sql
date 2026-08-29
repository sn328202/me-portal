-- The Table Book holds every booking now, not only restaurants: a wine
-- tasting, paragliding, a show, a museum slot. Anything with a time and a
-- confirmation. The column called `restaurant` is the last thing insisting
-- otherwise.
--
-- This rename was deliberately left out of Stage 1. Stage 1 was additive, and
-- a rename is not: the moment it ran, every read of `restaurant` in the live
-- app would have broken until a deploy caught up. So both names exist for
-- now, kept in step by a trigger, and Stage 5 drops the old one along with
-- everything else that is being retired.

alter table public.reservations
    add column if not exists name text;

update public.reservations set name = restaurant where name is null;

alter table public.reservations alter column name set not null;

comment on column public.reservations.name is
    'What is booked. Was `restaurant`, which is kept in step by a trigger until Stage 5 drops it.';

-- Whichever one you write, the other follows. Old code and new code can both
-- be right at the same time, which is the whole point of doing it this way.
create or replace function public.reservations_keep_names_in_step()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'INSERT' then
        if new.name is null then new.name := new.restaurant; end if;
        if new.restaurant is null then new.restaurant := new.name; end if;
    elsif new.name is distinct from old.name then
        new.restaurant := new.name;
    elsif new.restaurant is distinct from old.restaurant then
        new.name := new.restaurant;
    end if;
    return new;
end;
$$;

drop trigger if exists reservations_names_in_step on public.reservations;
create trigger reservations_names_in_step
    before insert or update on public.reservations
    for each row execute function public.reservations_keep_names_in_step();

-- A kind that is actually used. Stage 1 added the column and defaulted every
-- existing row to 'table', which was true of all 78 of them because a
-- restaurant was the only thing that could be booked.
alter table public.reservations
    add constraint reservations_kind_known
    check (kind is null or kind in ('table', 'tasting', 'activity', 'show', 'transport', 'stay', 'other'));
