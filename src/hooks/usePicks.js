import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { yearFor } from '../utils/picks';

/**
 * The answers to the blanks.
 *
 * Small enough to fetch whole — five media types by nine or so slots is under
 * fifty rows even when the page is completely full — so there is no filtering
 * here and no pagination. The page decides what to draw; this only knows how
 * to read, replace and clear one blank.
 *
 * Filling a blank that is already filled is an upsert, not an insert, because
 * choosing a different favourite means replacing the old one rather than
 * having two.
 */
export const usePicks = () => {
    const { user } = useAuth();
    const [picks, setPicks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!user) { setPicks([]); setLoading(false); return; }
        try {
            const { data, error: err } = await supabase
                .from('library_picks')
                .select('*')
                .eq('user_id', user.id);
            if (err) throw err;
            setPicks(data || []);
            setError(null);
        } catch (err) {
            setError(err.message || 'Could not read your picks.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { load(); }, [load]);

    /** Put something in a blank. */
    const setPick = useCallback(async (media, slot, position, item, year) => {
        if (!user) return;
        const row = {
            user_id: user.id,
            media,
            slot,
            position,
            year: yearFor(slot, year),
            title: String(item.title || '').trim(),
            creator: item.creator || null,
            image_url: item.image_url || null,
            link: item.link || null,
            note: item.note || null,
            source: item.source || 'manual',
            source_id: item.source_id || null,
            updated_at: new Date().toISOString(),
        };
        if (!row.title) return;

        // Optimistic, because a favourite film should appear the instant it is
        // chosen — the round trip is the slowest part of picking one.
        setPicks((prev) => [
            ...prev.filter((p) => !(
                p.media === media && p.slot === slot
                && (p.position ?? 0) === position && (p.year ?? 0) === row.year
            )),
            { ...row, id: `pending-${media}-${slot}-${position}-${row.year}` },
        ]);

        const { error: err } = await supabase
            .from('library_picks')
            .upsert(row, { onConflict: 'user_id,media,slot,position,year' });
        if (err) { setError(err.message); }
        await load();
    }, [user, load]);

    /** Empty a blank again. */
    const clearPick = useCallback(async (pick) => {
        if (!user || !pick?.id) return;
        setPicks((prev) => prev.filter((p) => p.id !== pick.id));
        const { error: err } = await supabase
            .from('library_picks').delete().eq('id', pick.id).eq('user_id', user.id);
        if (err) { setError(err.message); await load(); }
    }, [user, load]);

    return { picks, loading, error, setPick, clearPick, reload: load };
};

export default usePicks;
