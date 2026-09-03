import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { makeToken, sortShares } from '../utils/shareLink';

/**
 * The links that exist for one trip.
 *
 * Written straight to `trip_shares` under RLS rather than through an endpoint:
 * making and revoking a link is the owner acting on her own row, which is
 * exactly what a policy of `auth.uid() = user_id` is for. The server only gets
 * involved on the other side of the link, where there is no session to check.
 */
export const useTripShares = (tripId) => {
    const { user } = useAuth();
    const [shares, setShares] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    /* The fetch, with no state set before the first await. Setting it
       synchronously here would run inside the effect and cascade a render
       before this one had finished. */
    const load = useCallback(async () => {
        if (!user || !tripId) { setShares([]); setLoading(false); return; }
        const { data, error: err } = await supabase
            .from('trip_shares')
            .select('token, trip_id, can_edit, label, created_at, revoked_at, last_seen_at, views')
            .eq('trip_id', tripId)
            .eq('user_id', user.id);
        if (err) setError(err.message);
        else { setError(null); setShares(sortShares(data || [])); }
        setLoading(false);
    }, [user, tripId]);

    useEffect(() => {
        let alive = true;
        (async () => {
            const { data, error: err } = !user || !tripId
                ? { data: [] }
                : await supabase
                    .from('trip_shares')
                    .select('token, trip_id, can_edit, label, created_at, revoked_at, last_seen_at, views')
                    .eq('trip_id', tripId)
                    .eq('user_id', user.id);
            if (!alive) return;
            if (err) setError(err.message);
            else { setError(null); setShares(sortShares(data || [])); }
            setLoading(false);
        })();
        return () => { alive = false; };
    }, [user, tripId]);

    const create = useCallback(async ({ canEdit = false, label = null } = {}) => {
        if (!user || !tripId) return null;
        const token = makeToken();
        const row = {
            token, trip_id: tripId, user_id: user.id, can_edit: canEdit, label,
        };
        const { error: err } = await supabase.from('trip_shares').insert(row);
        if (err) { setError(err.message); return null; }
        setError(null);
        await load();
        return token;
    }, [user, tripId, load]);

    /* Revoked, not deleted. The row is the answer to "did the link I sent
       actually get opened", and that answer outlives the link. */
    const revoke = useCallback(async (token) => {
        if (!user) return;
        const { error: err } = await supabase
            .from('trip_shares')
            .update({ revoked_at: new Date().toISOString() })
            .eq('token', token)
            .eq('user_id', user.id);
        if (err) setError(err.message);
        else { setError(null); await load(); }
    }, [user, load]);

    return { shares, loading, error, create, revoke, reload: load };
};
