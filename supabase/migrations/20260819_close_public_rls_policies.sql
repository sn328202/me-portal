-- ============================================================
-- Close the permissive RLS policies
-- ------------------------------------------------------------
-- RLS was enabled on all 27 tables, but 19 of them also carried
-- a policy of `USING (true) WITH CHECK (true)` FOR ALL TO public.
-- Postgres OR's permissive policies together, so those sat
-- alongside the `auth.uid() = user_id` policies and cancelled
-- them out entirely. Anyone holding the anon key — which ships
-- inside the JavaScript bundle on every page load — could read,
-- insert, update and delete every row in those tables.
--
-- Applied 2026-08-19. Safe to run more than once.
-- ============================================================

begin;

-- 1. Backfill the only orphaned rows in the database.
--    recipe_tags is a tag *vocabulary* (id, name, created_at, user_id),
--    not a join table. 23 of its 27 rows are the default tag list seeded
--    on 2026-01-29 (Lunch, Dinner, Dessert, Quick, Vegetarian...) with no
--    owner. Without this they vanish the moment the permissive policy goes.
update public.recipe_tags
   set user_id = (select id from auth.users where email = 'neha.sule@hotmail.com')
 where user_id is null;


-- 2. Drop every `true` policy.
drop policy if exists "Allow public access"        on public.atlas_trips;
drop policy if exists "Allow public access"        on public.atlas_waypoints;
drop policy if exists "Allow public access"        on public.chores;
drop policy if exists "Allow public access"        on public.goals;
drop policy if exists "Allow public access"        on public.habits;
drop policy if exists "Allow public access"        on public.hobbies;
drop policy if exists "Allow public access"        on public.social_plans;
drop policy if exists "Allow public access"        on public.todos;
drop policy if exists "Allow public access"        on public.provisions;

drop policy if exists "Public Access Game Logs"    on public.game_logs;
drop policy if exists "Public Access Ingredients"  on public.ingredients;
drop policy if exists "Public Access Library"      on public.library_items;
drop policy if exists "Public Access Meal Plans"   on public.meal_plans;
drop policy if exists "Public Access Pantry"       on public.pantry_ingredients;
drop policy if exists "Public Access Recipes"      on public.recipes;
drop policy if exists "Public Access Treasury"     on public.treasury_items;

-- day_plans, plan_items and recipe_tags spelled theirs out per command
drop policy if exists "Allow public read access"   on public.day_plans;
drop policy if exists "Allow public insert access" on public.day_plans;
drop policy if exists "Allow public update access" on public.day_plans;
drop policy if exists "Allow public delete access" on public.day_plans;

drop policy if exists "Allow public read access"   on public.plan_items;
drop policy if exists "Allow public insert access" on public.plan_items;
drop policy if exists "Allow public update access" on public.plan_items;
drop policy if exists "Allow public delete access" on public.plan_items;

drop policy if exists "Allow public read access"   on public.recipe_tags;
drop policy if exists "Allow public insert access" on public.recipe_tags;
drop policy if exists "Allow public update access" on public.recipe_tags;
drop policy if exists "Allow public delete access" on public.recipe_tags;


-- 3. `provisions` had the permissive policy as its ONLY policy, so
--    dropping it would lock the table completely. Give it the same
--    ownership rule every other table uses.
drop policy if exists "Users can manage their own provisions" on public.provisions;
create policy "Users can manage their own provisions"
    on public.provisions for all to authenticated
    using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- 4. `game_logs` has no user_id column at all, so it cannot be scoped
--    to an owner. It is empty and nothing in the app reads or writes
--    it, so it stays locked (RLS on, no policy = no access) rather
--    than staying world-writable.
--    To revive it later: add a user_id column and a matching policy.


-- 5. `public.claim_orphan_data` is SECURITY DEFINER and callable by
--    the anon role over /rest/v1/rpc/. It takes a target user id,
--    which makes it a data-reassignment primitive anyone can invoke.
--    Nothing in the codebase calls it — it was a one-off repair tool.
drop function if exists public.claim_orphan_data();
drop function if exists public.claim_orphan_data(text);

commit;
