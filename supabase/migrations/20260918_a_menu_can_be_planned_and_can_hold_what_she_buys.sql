-- A menu can now say when it is being served, and carry the plan for cooking it.
-- The serve time is a wall clock on purpose: "Saturday at 8" is the answer she
-- wants back, not an instant that shifts if she happens to be somewhere else.
alter table public.user_larder_menus
    add column if not exists serve_date date,
    add column if not exists serve_time text,
    add column if not exists plan jsonb;

-- A course can hold something she is buying rather than cooking: the Diet Coke,
-- the Whole Foods cookies. Same table, same ordering, recipe_id simply null and
-- a name in its place.
alter table public.user_larder_menu_recipes
    add column if not exists item_name text,
    add column if not exists item_note text;

-- A row is one or the other, never neither.
alter table public.user_larder_menu_recipes
    drop constraint if exists menu_entry_is_recipe_or_item;
alter table public.user_larder_menu_recipes
    add constraint menu_entry_is_recipe_or_item
    check (recipe_id is not null or nullif(btrim(item_name), '') is not null);
