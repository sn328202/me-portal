-- The ideas board is now the only staging area — the Daydream's brainstorm
-- column merges into it — so it has to be able to hold what a card held
-- there. Two things it could not:
--
-- The emoji. She asked for it to cross into the Atlas and it never has,
-- because there was nowhere on an idea to put it. An idea picked up on the
-- board keeps its face when it lands on the day.
--
-- The place. Adding something from the form with a location picked, but
-- choosing "just an idea", threw away the Google place and its photo — so
-- promoting it later gave a card with no picture and no rating, and the only
-- fix was to search for it again.

alter table public.atlas_ideas
    add column if not exists icon text,
    add column if not exists place_id text,
    add column if not exists place_data jsonb;

comment on column public.atlas_ideas.icon is
    'The emoji on the card. Carried onto the day when the idea is promoted.';
