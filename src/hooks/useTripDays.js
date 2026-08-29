import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { tripCost, lodgingByNight, stayOn } from '../utils/tripCosts';
import { datesBetween } from '../utils/tripDates';
import { legOn, legsOn, legDestination, cityLabelOn } from '../utils/tripLegs';

/**
 * A trip's days, the things planned in them, and what it all costs.
 *
 * The days are derived from the trip's own start and end dates rather than
 * created by hand: a trip that runs the 16th to the 31st has sixteen days
 * whether or not anything is planned in them, exactly as the spreadsheet had
 * sixteen columns.
 */

export { datesBetween } from '../utils/tripDates';

export const useTripDays = (trip) => {
    const { user } = useAuth();
    const [days, setDays] = useState([]);
    const [items, setItems] = useState({});
    const [stays, setStays] = useState([]);
    const [legs, setLegs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [weatherState, setWeatherState] = useState({ busy: false, message: null });

    const tripId = trip?.id ?? null;

    const load = useCallback(async () => {
        if (!user || !tripId) { setDays([]); setItems({}); setStays([]); setLegs([]); return; }
        setLoading(true);
        try {
            const { data: dayRows, error } = await supabase
                .from('atlas_days').select('*')
                .eq('trip_id', tripId).eq('user_id', user.id).order('date');
            if (error) throw error;

            setDays(dayRows || []);

            const ids = (dayRows || []).map((d) => d.id);
            if (!ids.length) { setItems({}); return; }

            const { data: itemRows } = await supabase
                .from('atlas_day_items').select('*')
                .in('day_id', ids).eq('user_id', user.id)
                .order('sort_order');

            const grouped = {};
            for (const row of itemRows || []) {
                (grouped[row.day_id] ||= []).push(row);
            }
            setItems(grouped);

            const { data: stayRows } = await supabase
                .from('atlas_stays').select('*')
                .eq('trip_id', tripId).eq('user_id', user.id).order('check_in');
            setStays(stayRows || []);

            const { data: legRows } = await supabase
                .from('atlas_legs').select('*')
                .eq('trip_id', tripId).eq('user_id', user.id).order('start_date');
            setLegs(legRows || []);
        } catch (err) {
            console.error('Error loading trip days:', err);
        } finally {
            setLoading(false);
        }
    }, [user, tripId]);

    useEffect(() => { load(); }, [load]);

    /**
     * Make sure the trip's days match its dates.
     *
     * The first version only ever inserted, on the reasoning that editing the
     * dates should not delete a day with things planned in it. True, but the
     * consequence was worse: every earlier or half-typed end date left its days
     * behind for ever, with no way to remove them. A trip ending 6 January had
     * thirty-six days running to the 27th.
     *
     * So: insert what is missing, and remove what has fallen outside the range
     * *and is empty*. A day with anything in it is kept and flagged instead —
     * it is evidence of a plan, and deleting it silently is the thing the first
     * version was right to avoid.
     */
    const ensureDays = useCallback(async () => {
        if (!user || !trip?.start_date) return;

        const wanted = datesBetween(trip.start_date, trip.end_date);
        // A half-typed date yields no range; do nothing rather than build days
        // for a date nobody meant.
        if (!wanted.length) return;

        const want = new Set(wanted);
        const have = new Set(days.map((d) => String(d.date).slice(0, 10)));

        const missing = wanted.filter((d) => !have.has(d));
        const orphans = days.filter((d) => !want.has(String(d.date).slice(0, 10)));

        /* Whether a day is worth keeping is decided against the database, not
           against `items`.

           `load` sets `days` and then fetches the items, so there is a render
           in between where every day looks empty. Deleting on that reading is
           how eight days imported from a sheet disappeared a second after
           they were created — and it would have taken real days with them
           given the right timing.

           One query, only for the days that are candidates, and only when
           there are any. */
        /* What counts as "nothing on it".
        
           `city` used to be in this list, and it is why shortening a trip
           did nothing: every day gets a city written to it by `syncCities`
           the moment a leg covers it, so no day was ever bare and no day was
           ever removed. She could add dates and never take them away.

           A city is a cache of the legs — it says so twenty lines below —
           and a cache is not work anyone would miss. Lodging, notes, money
           and the things planned on the day are hers; those still protect
           it. */
        const looksBare = (d) => !d.lodging && !d.notes
            && ['lodging', 'food', 'excursions', 'transport', 'points']
                .every((b) => !Number(d[`cost_${b}`]));

        const bare = orphans.filter(looksBare);
        let disposable = [];

        if (bare.length) {
            const { data: held, error: readError } = await supabase
                .from('atlas_day_items').select('day_id')
                .in('day_id', bare.map((d) => d.id)).eq('user_id', user.id);
            // Could not check: keep them. A day wrongly kept is a tidy-up; a
            // day wrongly deleted is someone's evening.
            if (!readError) {
                const busy = new Set((held || []).map((r) => r.day_id));
                disposable = bare.filter((d) => !busy.has(d.id)).map((d) => d.id);
            }
        }

        if (!missing.length && !disposable.length) return;

        if (missing.length) {
            /* Upsert, not insert. `days` here is state, and state can be
               behind the table — an import that has just created the same
               dates, another tab, a re-render mid-flight. `(trip_id, date)`
               is unique, so an insert that overlaps comes back 409 and takes
               the whole batch with it. A day that already exists is not an
               error; it is the desired state. */
            const { error } = await supabase.from('atlas_days').upsert(
                missing.map((date) => ({ trip_id: trip.id, user_id: user.id, date })),
                { onConflict: 'trip_id,date', ignoreDuplicates: true }
            );
            if (error) console.error('Error creating days:', error);
        }
        if (disposable.length) {
            await supabase.from('atlas_days').delete()
                .in('id', disposable).eq('user_id', user.id);
        }
        await load();
    }, [user, trip, days, load]);

    /* ---------- legs: a city, for a stretch of days ---------------------- */

    /**
     * Keep every day's city agreeing with the leg that covers it.
     *
     * The city could be read from the legs at render time and never stored,
     * which is cleaner right up until the weather job runs: it reads
     * `atlas_days.city` server-side and knows nothing about legs. So the
     * column stays, as a cache — and a cache that is only written when a leg
     * is edited drifts, which is exactly what happened: three legs added in
     * quick succession left 25 December still saying "Air Travel" because each
     * write was made against a stale copy of the days.
     *
     * Reconciling here instead means the legs are the only thing anyone edits,
     * and the column catches up whenever it disagrees.
     */
    useEffect(() => {
        if (!user || !legs.length || !days.length) return;

        const wanted = new Map();
        for (const day of days) {
            const leg = legOn(legs, day.date);
            // The *destination*, not the leg's name: this column is what the
            // weather job geocodes, and "Air Travel" resolves to a real place
            // that is not the one she is flying to.
            const city = leg ? legDestination(leg, legs) : '';
            if (city && city !== day.city) wanted.set(day.id, city);
        }
        if (!wanted.size) return;

        setDays((prev) => prev.map((d) => (wanted.has(d.id) ? { ...d, city: wanted.get(d.id) } : d)));

        // Grouped by city, so a fifteen-day trip is three writes and not fifteen.
        const byCity = {};
        for (const [id, city] of wanted) (byCity[city] ||= []).push(id);
        (async () => {
            for (const [city, ids] of Object.entries(byCity)) {
                const { error } = await supabase.from('atlas_days')
                    .update({ city }).in('id', ids).eq('user_id', user.id);
                if (error) console.error('Error stamping city:', error);
            }
        })();
    }, [user, legs, days]);

    const addLeg = useCallback(async (leg) => {
        if (!user || !tripId) return;
        const { data, error } = await supabase.from('atlas_legs')
            .insert([{ ...leg, trip_id: tripId, user_id: user.id, sort_order: legs.length }])
            .select().single();
        if (error) { console.error('Error adding leg:', error); return; }
        setLegs((prev) => [...prev, data]
            .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date))));
    }, [user, tripId, legs.length]);

    const updateLeg = useCallback(async (id, patch) => {
        if (!user) return;
        const before = legs.find((l) => l.id === id);
        if (!before) return;
        setLegs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l))
            .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date))));
        const { error } = await supabase
            .from('atlas_legs').update(patch).eq('id', id).eq('user_id', user.id);
        if (error) {
            // end_date >= start_date is a check constraint, so a backwards edit
            // is refused by the database rather than half-applied.
            setLegs((prev) => prev.map((l) => (l.id === id ? before : l)));
            console.error('Error updating leg:', error);
        }
    }, [user, legs]);

    const deleteLeg = useCallback(async (id) => {
        if (!user) return;
        setLegs((prev) => prev.filter((l) => l.id !== id));
        await supabase.from('atlas_legs').delete().eq('id', id).eq('user_id', user.id);
    }, [user]);

    /* ---------- lodging, which spans nights ----------------------------- */

    const addStay = useCallback(async (stay) => {
        if (!user || !tripId) return;
        const { data, error } = await supabase.from('atlas_stays')
            .insert([{ ...stay, trip_id: tripId, user_id: user.id }]).select().single();
        if (error) { console.error('Error adding stay:', error); return; }
        setStays((prev) => [...prev, data].sort((a, b) => a.check_in.localeCompare(b.check_in)));
    }, [user, tripId]);

    const updateStay = useCallback(async (id, patch) => {
        if (!user) return;
        const before = stays.find((s) => s.id === id);
        setStays((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
        const { error } = await supabase
            .from('atlas_stays').update(patch).eq('id', id).eq('user_id', user.id);
        if (error) {
            // The dates carry a check constraint (check_out must be after
            // check_in), so a bad edit is refused rather than stored.
            setStays((prev) => prev.map((s) => (s.id === id ? before : s)));
            console.error('Error updating stay:', error);
        }
    }, [user, stays]);

    const deleteStay = useCallback(async (id) => {
        if (!user) return;
        setStays((prev) => prev.filter((s) => s.id !== id));
        await supabase.from('atlas_stays').delete().eq('id', id).eq('user_id', user.id);
    }, [user]);

    const updateDay = useCallback(async (id, patch) => {
        if (!user) return;
        const before = days.find((d) => d.id === id);
        setDays((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
        const { error } = await supabase
            .from('atlas_days').update(patch).eq('id', id).eq('user_id', user.id);
        if (error) {
            setDays((prev) => prev.map((d) => (d.id === id ? before : d)));
            console.error('Error updating day:', error);
        }
    }, [user, days]);

    const addItem = useCallback(async (dayId, item) => {
        if (!user) return;
        const row = {
            day_id: dayId,
            user_id: user.id,
            sort_order: (items[dayId] || []).length,
            ...item,
        };
        const { data, error } = await supabase
            .from('atlas_day_items').insert([row]).select().single();
        if (error) { console.error('Error adding item:', error); return null; }
        setItems((prev) => ({ ...prev, [dayId]: [...(prev[dayId] || []), data] }));
        // Handed back so a caller that just made one can put the cursor in it.
        return data;
    }, [user, items]);

    const updateItem = useCallback(async (dayId, id, patch) => {
        if (!user) return;
        setItems((prev) => ({
            ...prev,
            [dayId]: (prev[dayId] || []).map((i) => (i.id === id ? { ...i, ...patch } : i)),
        }));
        const { error } = await supabase
            .from('atlas_day_items').update(patch).eq('id', id).eq('user_id', user.id);
        if (error) { console.error('Error updating item:', error); load(); }
    }, [user, load]);

    /**
     * Move a planned thing to another hour, and possibly another day.
     *
     * A move within a day is a patch; a move across days changes which row it
     * hangs off, so the local state has to lift it out of one list and into
     * another rather than editing it in place. Doing that wrong leaves the item
     * drawn in both columns until the next reload, which looks like it was
     * copied.
     */
    const moveItem = useCallback(async (fromDayId, toDayId, id, patch) => {
        if (!user) return;
        const source = items[fromDayId] || [];
        const moving = source.find((i) => i.id === id);
        if (!moving) return;

        const next = { ...moving, ...patch, day_id: toDayId };

        setItems((prev) => {
            const out = { ...prev, [fromDayId]: (prev[fromDayId] || []).filter((i) => i.id !== id) };
            if (fromDayId !== toDayId) out[toDayId] = [...(prev[toDayId] || []), next];
            else out[fromDayId] = [...out[fromDayId], next];
            return out;
        });

        const { error } = await supabase.from('atlas_day_items')
            .update({ ...patch, day_id: toDayId })
            .eq('id', id).eq('user_id', user.id);
        if (error) { console.error('Error moving item:', error); load(); }
    }, [user, items, load]);

    /**
     * Remove a day and everything on it, because she said so.
     *
     * `ensureDays` will not do this on its own — a day with plans on it is
     * someone's evening and is never deleted by a date field losing focus.
     * This is the other half of that: an explicit answer to an explicit
     * question.
     */
    const dropDay = useCallback(async (dayId) => {
        if (!user) return;
        setDays((prev) => prev.filter((d) => d.id !== dayId));
        setItems((prev) => {
            const out = { ...prev };
            delete out[dayId];
            return out;
        });
        const { error } = await supabase.from('atlas_days')
            .delete().eq('id', dayId).eq('user_id', user.id);
        if (error) { console.error('Error removing day:', error); load(); }
    }, [user, load]);

    const deleteItem = useCallback(async (dayId, id) => {
        if (!user) return;
        setItems((prev) => ({ ...prev, [dayId]: (prev[dayId] || []).filter((i) => i.id !== id) }));
        await supabase.from('atlas_day_items').delete().eq('id', id).eq('user_id', user.id);
    }, [user]);

    /* ---------- an old sheet, brought in ---------------------------------- */

    /**
     * Write an imported grid into the trip.
     *
     * Items are *replaced* for the days the import touches rather than added
     * to. Importing the same sheet twice is a thing people do — to pick up an
     * edit, or because they were not sure it worked the first time — and
     * appending would quietly double every dinner. Days the sheet says nothing
     * about are left completely alone.
     */
    const applyImport = useCallback(async ({ days: rows = [], items: rowItems = [] } = {}) => {
        if (!user || !tripId) return { ok: false, reason: 'No trip open.' };
        if (!rows.length) return { ok: false, reason: 'Nothing to import.' };

        const dates = rows.map((r) => String(r.date).slice(0, 10))
            .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
            .sort();
        if (!dates.length) return { ok: false, reason: 'No usable dates in that sheet.' };

        /* Make the trip cover what the sheet describes, before creating a
           single day.

           This is what made an import look like it worked and then vanish.
           `ensureDays` deletes days that fall outside the trip's own dates
           and have nothing in them — reasonable on its own, and fatal here:
           the sheet's days landed outside the range, `ensureDays` ran with
           `items` still empty because the load had not come back, judged all
           eight of them disposable, and swept them away. The report said
           "brought in 8 days and 10 things" and it was telling the truth at
           the time.

           A sheet describing eight days *is* the trip's dates. Widening only,
           because an import is an addition. */
        const from = dates[0];
        const to = dates[dates.length - 1];
        const start = String(trip?.start_date || '').slice(0, 10);
        const end = String(trip?.end_date || '').slice(0, 10) || start;
        const span = {};
        if (!start || from < start) span.start_date = from;
        if (!end || to > end) span.end_date = to;
        if (Object.keys(span).length) {
            const { error } = await supabase.from('atlas_trips')
                .update(span).eq('id', tripId);
            if (error) return { ok: false, reason: error.message };
        }

        /* Every date the trip now covers, not only the ones in the sheet — so
           a gap in the middle of an imported fortnight is still a day. */
        const wanted = datesBetween(span.start_date || start || from, span.end_date || end || to);
        const have = new Set(days.map((d) => String(d.date).slice(0, 10)));
        const missing = (wanted.length ? wanted : dates).filter((d) => !have.has(d));

        if (missing.length) {
            // Upsert: `days` is state and may be behind the table, and
            // (trip_id, date) is unique — an overlap is a 409 that takes the
            // whole batch with it.
            const { error } = await supabase.from('atlas_days').upsert(
                missing.map((date) => ({ trip_id: tripId, user_id: user.id, date })),
                { onConflict: 'trip_id,date', ignoreDuplicates: true }
            );
            if (error) return { ok: false, reason: error.message };
        }

        // Re-read rather than trusting local state: the inserts above are the
        // only source of the ids the items have to hang off.
        const { data: fresh, error: readError } = await supabase
            .from('atlas_days').select('id, date')
            .eq('trip_id', tripId).eq('user_id', user.id);
        if (readError) return { ok: false, reason: readError.message };

        const idFor = new Map((fresh || []).map((d) => [String(d.date).slice(0, 10), d.id]));

        for (const row of rows) {
            const id = idFor.get(String(row.date).slice(0, 10));
            if (!id) continue;
            // Everything but the date, which is what found the day.
            const patch = { ...row };
            delete patch.date;
            // A blank cell in the sheet is "not filled in", not "set to empty".
            const meaningful = Object.fromEntries(
                Object.entries(patch).filter(([, v]) => v !== '' && v !== null && v !== 0)
            );
            if (Object.keys(meaningful).length) {
                await supabase.from('atlas_days').update(meaningful)
                    .eq('id', id).eq('user_id', user.id);
            }
        }

        const touched = [...new Set(rowItems.map((i) => idFor.get(String(i.date).slice(0, 10))))]
            .filter(Boolean);
        if (touched.length) {
            await supabase.from('atlas_day_items').delete()
                .in('day_id', touched).eq('user_id', user.id);
        }

        const rowsToInsert = [];
        const counts = {};
        for (const item of rowItems) {
            const dayId = idFor.get(String(item.date).slice(0, 10));
            if (!dayId || !item.title) continue;
            counts[dayId] = (counts[dayId] || 0) + 1;
            rowsToInsert.push({
                day_id: dayId,
                user_id: user.id,
                title: item.title,
                kind: item.kind || 'todo',
                start_time: item.start_time || null,
                sort_order: counts[dayId] - 1,
            });
        }
        if (rowsToInsert.length) {
            const { error } = await supabase.from('atlas_day_items').insert(rowsToInsert);
            if (error) return { ok: false, reason: error.message };
        }

        await load();
        return { ok: true, days: rows.length, items: rowsToInsert.length };
    }, [user, tripId, trip, days, load]);

    /**
     * Ask the server to fill in the weather.
     *
     * Done server-side because it is several requests per trip and the result
     * is cached onto the day rows - there is no reason to re-fetch ten years
     * of history every time the page opens.
     */
    const refreshWeather = useCallback(async () => {
        if (!tripId) return;
        setWeatherState({ busy: true, message: null });
        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session?.session?.access_token;
            const res = await fetch('/api/weather', {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                body: JSON.stringify({ tripId }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'that did not work');
            await load();
            setWeatherState({
                busy: false,
                message: result.filled
                    ? `Weather filled in for ${result.filled} of ${result.of} days.`
                    : (result.reason || 'No weather available for these dates.'),
            });
        } catch (err) {
            setWeatherState({ busy: false, message: err.message });
        }
    }, [tripId, load]);

    const costs = useMemo(
        () => tripCost(days, items, trip?.party_size || 1, stays),
        [days, items, trip?.party_size, stays]
    );

    /** Days that no longer fall inside the trip but still hold something. */
    const strays = useMemo(() => {
        const want = new Set(datesBetween(trip?.start_date, trip?.end_date));
        if (!want.size) return [];
        return days.filter((d) => !want.has(String(d.date).slice(0, 10)));
    }, [days, trip?.start_date, trip?.end_date]);

    /** The trip's dates, as the route view needs them to spot uncovered days. */
    const tripDates = useMemo(
        () => datesBetween(trip?.start_date, trip?.end_date),
        [trip?.start_date, trip?.end_date]
    );

    const lodgingPerNight = useMemo(
        () => lodgingByNight(stays, trip?.party_size || 1),
        [stays, trip?.party_size]
    );

    return {
        days, items, stays, legs, strays, tripDates, loading, costs, lodgingPerNight,
        stayOnDate: (date) => stayOn(stays, date),
        legOnDate: (date) => legOn(legs, date),
        legsOnDate: (date) => legsOn(legs, date),
        cityLabelFor: (date) => cityLabelOn(legs, date),
        addStay, updateStay, deleteStay,
        addLeg, updateLeg, deleteLeg, applyImport,
        weatherBusy: weatherState.busy,
        weatherMessage: weatherState.message,
        ensureDays, updateDay, addItem, updateItem, moveItem, deleteItem, refreshWeather, reload: load,
        dropDay,
    };
};
