-- The kind of thing a stop is, as one emoji.
--
-- Most places have no usable Google photo, so most cards were a title and an
-- address in a column of titles and addresses. The app guesses an emoji from
-- what the stop is called; this column holds the guess she overrode, and only
-- that — a null here means "keep guessing", which is what should happen when
-- she renames the card.
alter table public.plan_items
    add column if not exists icon text;

comment on column public.plan_items.icon is
    'One emoji, chosen by the user. Null means the app guesses from the title.';
