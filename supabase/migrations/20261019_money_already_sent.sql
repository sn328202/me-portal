-- Money people have sent each other outside any one cost: "Dad has already
-- sent me $2,200". It counts toward settling up.
-- [{"id": "...", "from": "Pushkar", "to": "Neha", "amount": 2200,
--   "currency": "USD", "usd": 2200, "date": "2026-10-19", "note": "..."}]
alter table public.atlas_trips add column if not exists transfers jsonb not null default '[]'::jsonb;
