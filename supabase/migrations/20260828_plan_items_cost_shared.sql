-- Whether a price is split across the party or paid by each person.
--
-- The Atlas has had `cost_shared` since it learned to add a trip up. The
-- Daydream, where the price is usually first typed, had nowhere to say it —
-- so a hundred-pound dinner for four crossed to the trip as "split" whatever
-- she meant, and she had to correct it on the other side.
--
-- Null is the same as true, which is what the Atlas already assumes: a price
-- on a plan is what the thing costs, and things are shared by default.
alter table public.plan_items
    add column if not exists cost_shared boolean;

comment on column public.plan_items.cost_shared is
    'True or null: the cost is split across the party. False: each person pays it.';
