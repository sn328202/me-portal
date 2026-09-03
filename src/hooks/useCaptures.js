import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * The voice-capture log. Every spoken thought that came in through the phone
 * Shortcut, what it became, and the rows to remove if it got it wrong.
 */
/**
 * How far down a chain of rows each table sits, so undo deletes a child
 * before the parent that owns it. Anything unlisted stands alone and can go
 * at any point.
 */
const DEPTHS = { atlas_day_items: 0, ingredients: 0, atlas_days: 1, atlas_trips: 2 };
const DEPTH = (table) => DEPTHS[table] ?? 0;

/** Did this delete fail because the table itself is gone? */
const GONE = (err) => err?.code === '42P01' || /does not exist/i.test(err?.message || '');

export const useCaptures = (limit = 20) => {
    const { user } = useAuth();
    const [captures, setCaptures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchCaptures = useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        }
        try {
            const { data, error: err } = await supabase
                .from('captures')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(limit);
            if (err) throw err;
            setCaptures(data || []);
            setError(null);
        } catch (err) {
            setError(err.message || 'Could not load captures');
        } finally {
            setLoading(false);
        }
    }, [user, limit]);

    useEffect(() => {
        fetchCaptures();
    }, [fetchCaptures]);

    // Live updates, so a capture spoken into the phone appears on the desktop
    // without a refresh.
    useEffect(() => {
        if (!user) return undefined;
        const channel = supabase
            .channel('captures-feed')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'captures', filter: `user_id=eq.${user.id}` },
                (payload) => setCaptures((prev) => [payload.new, ...prev].slice(0, limit))
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user, limit]);

    /** Put back everything a capture did, then mark it undone. */
    const undoCapture = async (capture) => {
        const actions = capture.actions || [];
        // Children first. One dictation can make a trip, a day inside it and
        // an item on that day, so this is three deep, not two — a flat
        // "children before parents" split put the trip and its day in the
        // same bucket and left the order between them to chance.
        const sorted = [...actions].sort((a, b) => DEPTH(a.table) - DEPTH(b.table));

        for (const action of sorted) {
            if (!action.table || !action.id) continue;
            /* Most actions made a row, so taking them back means deleting it.
               Some only changed one — "we're out of garlic" flips a column on
               an ingredient she curated — and those carry what to put back.
               Deleting there would take the garlic with it. */
            const put = action.undo?.set;
            const { error: err } = put
                ? await supabase.from(action.table).update(put)
                    .eq('id', action.id).eq('user_id', user.id)
                : await supabase.from(action.table).delete()
                    .eq('id', action.id).eq('user_id', user.id);
            // A capture from before a room was retired points at a table that
            // no longer exists. There is nothing left to take back, which is
            // not a failure — refusing to undo the rest of the dictation
            // because of it would be.
            if (err && !GONE(err)) {
                setError(`Could not undo: ${err.message}`);
                return false;
            }
        }

        const { error: markErr } = await supabase
            .from('captures')
            .update({ undone: true })
            .eq('id', capture.id)
            .eq('user_id', user.id);
        if (markErr) {
            setError(markErr.message);
            return false;
        }

        setCaptures((prev) => prev.map((c) => (c.id === capture.id ? { ...c, undone: true } : c)));
        return true;
    };

    const deleteCapture = async (id) => {
        setCaptures((prev) => prev.filter((c) => c.id !== id));
        await supabase.from('captures').delete().eq('id', id).eq('user_id', user.id);
    };

    return { captures, loading, error, undoCapture, deleteCapture, refresh: fetchCaptures };
};
