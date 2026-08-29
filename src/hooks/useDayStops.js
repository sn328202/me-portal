import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { compareItems } from '../utils/dayOrder';
import { toStop, toRow, toIdea, ideaRow, boardFor, readCost } from '../utils/dayBuild';

const sortStops = (list) => [...list].sort(compareItems);
const isTemp = (id) => typeof id === 'string' && id.startsWith('temp-');

/**
 * One day of a trip, as something you can edit.
 *
 * This is the Daydream's editor with the storage swapped underneath: the same
 * behaviour, the same vocabulary in memory, writing to `atlas_day_items`
 * instead of `plan_items`. The translation happens in `utils/dayBuild`.
 *
 * Every awkward lesson from the Daydream is kept, because they were all paid
 * for once already:
 *
 * - A delete goes to the database immediately. Nobody presses Save after
 *   deleting something; deleting *is* the decision. If the database refuses,
 *   the card comes back and says so.
 * - Everything else is local and saved 900ms after she stops. The timer
 *   restarts on every change, so typing a title is one save, not one a letter.
 * - State updates are functional. Changing a time and then a length before
 *   React catches up used to compute the second from the pre-first list and
 *   throw the first away.
 * - After a save, the rows only replace state when the *set* of them changed.
 *   Doing it unconditionally replaced every card object 900ms after every
 *   keystroke, which remounted every input and left the timeline lurching.
 */
export const useDayStops = ({ tripId, date }) => {
    const { user } = useAuth();

    const [day, setDay] = useState(null);
    const [trip, setTrip] = useState(null);
    const [stops, setStops] = useState([]);
    const [ideas, setIdeas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState(null);
    const [error, setError] = useState(null);
    const [dirty, setDirty] = useState(false);

    const savingRef = useRef(false);
    const stopsRef = useRef(stops);
    stopsRef.current = stops;
    const dayRef = useRef(null);
    dayRef.current = day;

    // ---- reading ---------------------------------------------------------

    const load = useCallback(async () => {
        if (!user || !tripId || !date) { setLoading(false); return; }
        setLoading(true);
        try {
            const { data: dayRow, error: dayErr } = await supabase
                .from('atlas_days')
                .select('*, atlas_trips(id, destination, start_date, end_date, status)')
                .eq('trip_id', tripId)
                .eq('date', date)
                .maybeSingle();
            if (dayErr) throw dayErr;

            setDay(dayRow || null);
            setTrip(dayRow?.atlas_trips || null);

            if (dayRow) {
                const { data: rows, error: itemErr } = await supabase
                    .from('atlas_day_items')
                    .select('*')
                    .eq('day_id', dayRow.id);
                if (itemErr) throw itemErr;
                setStops(sortStops((rows || []).map(toStop)));
            } else {
                setStops([]);
            }

            // The board is the trip's ideas plus everything captured before it
            // belonged to a trip at all.
            const { data: ideaRows, error: ideaErr } = await supabase
                .from('atlas_ideas')
                .select('*')
                .eq('user_id', user.id)
                .is('promoted_at', null)
                .order('sort_order');
            if (ideaErr) throw ideaErr;
            setIdeas(boardFor(ideaRows || [], tripId).map(toIdea));

            setError(null);
        } catch (err) {
            setError(err.message || 'Could not open this day');
        } finally {
            setLoading(false);
        }
    }, [user, tripId, date]);

    useEffect(() => { load(); }, [load]);

    // ---- writing ---------------------------------------------------------

    const runSave = useCallback(async () => {
        const here = dayRef.current;
        if (!user || !here) return;

        const ordered = sortStops(stopsRef.current).map((s, i) => ({ ...s, sort_order: i }));
        const fresh = ordered.filter((s) => isTemp(s.id));
        const known = ordered.filter((s) => !isTemp(s.id));

        if (known.length) {
            const { error: err } = await supabase.from('atlas_day_items').upsert(
                known.map((s) => ({ id: s.id, ...toRow(s, { dayId: here.id, userId: user.id, order: s.sort_order }) }))
            );
            if (err) { setError(`Could not save the changes: ${err.message}`); return; }
        }

        let made = [];
        if (fresh.length) {
            const { data, error: err } = await supabase.from('atlas_day_items').insert(
                fresh.map((s) => toRow(s, { dayId: here.id, userId: user.id, order: s.sort_order }))
            ).select();
            if (err) { setError(`Could not add ${fresh.length === 1 ? 'that stop' : 'those stops'}: ${err.message}`); return; }
            made = data || [];
        }

        setError(null);

        // The new cards have real ids now. Swapping them in here is what stops
        // the next save inserting the same cards a second time.
        if (made.length) {
            setStops((current) => {
                const spare = made.map(toStop);
                return current.map((s) => (isTemp(s.id) ? (spare.shift() || s) : s));
            });
        }

        setDirty(false);
        setSavedAt(Date.now());
    }, [user]);

    const save = useCallback(async () => {
        if (savingRef.current) return;
        savingRef.current = true;
        setSaving(true);
        try { await runSave(); } finally {
            savingRef.current = false;
            setSaving(false);
        }
    }, [runSave]);

    useEffect(() => {
        if (!dirty || saving || !day) return undefined;
        const timer = setTimeout(() => { save(); }, 900);
        return () => clearTimeout(timer);
    }, [dirty, stops, saving, day, save]);

    const updateStop = useCallback((id, patch) => {
        setStops((list) => {
            const next = list.map((s) => (s.id === id ? { ...s, ...patch } : s));
            // A changed time changes where the card belongs.
            return patch.start_time !== undefined ? sortStops(next) : next;
        });
        setDirty(true);
    }, []);

    const addStop = useCallback((stop) => {
        setStops((list) => sortStops([...list, { ...stop, id: `temp-${Date.now()}`, is_brainstorm: false }]));
        setDirty(true);
    }, []);

    const deleteStop = useCallback(async (id) => {
        const going = stopsRef.current.find((s) => s.id === id);
        setStops((list) => list.filter((s) => s.id !== id));

        if (isTemp(id)) { setDirty(true); return; }

        const { error: err } = await supabase.from('atlas_day_items').delete().eq('id', id);
        if (err) {
            setError('That would not delete — it is still there. Try again.');
            if (going) setStops((list) => sortStops([...list, going]));
            return;
        }
        setError(null);
    }, []);

    const reorder = useCallback((next) => {
        setStops(sortStops(next));
        setDirty(true);
    }, []);

    // ---- the board -------------------------------------------------------

    const addIdea = useCallback(async (stop) => {
        if (!user) return;
        const { data, error: err } = await supabase.from('atlas_ideas')
            .insert(ideaRow(stop, { tripId, userId: user.id, order: ideas.length }))
            .select()
            .single();
        if (err) { setError(`Could not put that on the board: ${err.message}`); return; }
        setIdeas((list) => [...list, toIdea(data)]);
    }, [user, tripId, ideas.length]);

    const updateIdea = useCallback(async (id, patch) => {
        setIdeas((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
        const row = {};
        if (patch.activity !== undefined) row.title = (patch.activity || '').trim() || 'Something';
        if (patch.notes !== undefined) row.notes = patch.notes || null;
        if (patch.location !== undefined) row.area = patch.location || null;
        if (patch.link !== undefined) row.url = patch.link || null;
        // readCost, not a bare Number: `|| null` turns a free thing into an
        // unpriced one, and free is a price worth keeping.
        if (patch.cost !== undefined) row.cost = readCost(patch.cost);
        if (patch.start_time !== undefined) row.start_time = patch.start_time || null;
        if (patch.icon !== undefined) row.icon = patch.icon || null;
        if (!Object.keys(row).length) return;
        const { error: err } = await supabase.from('atlas_ideas').update(row).eq('id', id);
        if (err) setError(`Could not save that idea: ${err.message}`);
    }, []);

    const deleteIdea = useCallback(async (id) => {
        const going = ideas.find((i) => i.id === id);
        setIdeas((list) => list.filter((i) => i.id !== id));
        const { error: err } = await supabase.from('atlas_ideas').delete().eq('id', id);
        if (err) {
            setError('That would not delete — it is still there. Try again.');
            if (going) setIdeas((list) => [...list, going]);
        }
    }, [ideas]);

    /**
     * An idea becomes a stop on this day.
     *
     * It moves rather than being copied. Two rows saying the same thing, kept
     * in step by hand, is the exact bug this whole merge exists to delete, and
     * it is not being reintroduced one drag at a time.
     */
    const promote = useCallback(async (id, at) => {
        const idea = ideas.find((i) => i.id === id);
        const here = dayRef.current;
        if (!idea || !here || !user) return;

        setIdeas((list) => list.filter((i) => i.id !== id));

        const row = toRow({ ...idea, start_time: at || idea.start_time || null }, {
            dayId: here.id, userId: user.id, order: stopsRef.current.length,
        });

        const { data, error: err } = await supabase.from('atlas_day_items').insert(row).select().single();
        if (err) {
            setError(`Could not put that on the day: ${err.message}`);
            setIdeas((list) => [...list, idea]);
            return;
        }

        setStops((list) => sortStops([...list, toStop(data)]));
        const { error: gone } = await supabase.from('atlas_ideas').delete().eq('id', id);
        // The stop is on the day either way; a leftover idea is untidy, not
        // lost work, and saying so is better than undoing what worked.
        if (gone) setError('That is on the day, but it is still on the board too. Refresh to tidy it.');
        else setError(null);
    }, [ideas, user]);

    /** And back off the day again. */
    const demote = useCallback(async (id) => {
        const stop = stopsRef.current.find((s) => s.id === id);
        if (!stop || !user) return;

        setStops((list) => list.filter((s) => s.id !== id));

        const { data, error: err } = await supabase.from('atlas_ideas')
            .insert(ideaRow(stop, { tripId, userId: user.id, order: ideas.length }))
            .select().single();
        if (err) {
            setError(`Could not move that to the board: ${err.message}`);
            setStops((list) => sortStops([...list, stop]));
            return;
        }
        setIdeas((list) => [...list, toIdea(data)]);
        if (!isTemp(id)) await supabase.from('atlas_day_items').delete().eq('id', id);
        setError(null);
    }, [user, tripId, ideas.length]);

    const timeline = useMemo(() => stops.filter((s) => !s.is_brainstorm), [stops]);

    return {
        day, trip, stops, timeline, ideas,
        loading, saving, savedAt, error, dirty,
        setError,
        addStop, updateStop, deleteStop, reorder,
        addIdea, updateIdea, deleteIdea, promote, demote,
        save, reload: load,
    };
};

export default useDayStops;
