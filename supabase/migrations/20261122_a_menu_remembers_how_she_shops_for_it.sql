-- A menu remembers how she shops for it: which dishes are made at double,
-- what is swapped or left out for this one evening, what is added by hand,
-- which other menus are bought for in the same trip, and what is already in
-- the basket. One jsonb column, because all of it is read and saved together
-- by the menu's shopping list and none of it is queried on its own.
alter table public.user_larder_menus
    add column if not exists shop jsonb;
