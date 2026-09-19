-- A day on the meal plan can now carry the same cooking schedule a menu can:
-- when she is serving, and the order to cook that day's recipes in so all of
-- it is ready at once. One per day, like the meal plan itself.
create table if not exists public.user_meal_day_plans (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    -- The day, as a calendar date. The serve time is a wall clock kept beside
    -- it rather than folded into a timestamp: "Saturday at 8" is the answer
    -- she wants back, not an instant that moves if she does.
    date date not null,
    serve_time text,
    plan jsonb,
    created_at timestamptz default now(),
    unique (user_id, date)
);

alter table public.user_meal_day_plans enable row level security;

drop policy if exists "own day plans" on public.user_meal_day_plans;
create policy "own day plans" on public.user_meal_day_plans
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists user_meal_day_plans_user_date
    on public.user_meal_day_plans (user_id, date);
