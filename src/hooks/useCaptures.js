import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * The voice-capture log. Every spoken thought that came in through the phone
 * Shortcut, what it became, and the rows to remove if it got it wrong.
 */
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

    /** Delete everything a capture created, then mark it undone. */
    const undoCapture = async (capture) => {
        const actions = capture.actions || [];
        // Children first: a plan_item's parent day_plan may also be in the list.
        const order = ['plan_items', 'ingredients'];
        const sorted = [...actions].sort(
            (a, b) => (order.includes(b.table) ? 1 : 0) - (order.includes(a.table) ? 1 : 0)
        );

        for (const action of sorted) {
            if (!action.table || !action.id) continue;
            const { error: err } = await supabase
                .from(action.table)
                .delete()
                .eq('id', action.id)
                .eq('user_id', user.id);
            if (err) {
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
