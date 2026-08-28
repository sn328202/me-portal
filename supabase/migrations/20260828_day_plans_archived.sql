-- Itineraries she is done with.
--
-- The sidebar listed every day plan ever made, so a Saturday from last March
-- sits between two things she is actually planning. Archiving is not
-- deleting: a day that happened is the best record of what a place was like
-- and what it cost, and it is the thing she looks back at when planning the
-- next one.
--
-- Nullable timestamp rather than a boolean, so "when did I put this away" is
-- answerable and unarchiving is just setting it back to null.
alter table public.day_plans
    add column if not exists archived_at timestamptz;

comment on column public.day_plans.archived_at is
    'When she archived this itinerary. Null means it is still on the board.';

-- The list is filtered on this on every load of the Daydream.
create index if not exists day_plans_archived_at_idx
    on public.day_plans (user_id, archived_at);
