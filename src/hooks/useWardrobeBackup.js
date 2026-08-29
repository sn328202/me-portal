import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
    WARDROBE_KEYS, META_KEY, plan, readLocal, writeLocal, describeSync, closetSize,
} from '../utils/wardrobeSync';

/**
 * A copy of the Wardrobe that survives a cleared browser.
 *
 * The outfit planner is a self-contained HTML app in an iframe that has always
 * kept its state in `localStorage`. That was fine until it turned out to be
 * holding the only copy of a closet built one garment at a time.
 *
 * This does not touch the planner. It sits beside it: reads the account's copy
 * before the planner starts, writes hers up whenever it changes. The planner
 * carries on believing localStorage is the whole world, which — because the
 * iframe is same-origin — it is.
 *
 * Signed out, none of this happens and the planner behaves exactly as it did
 * before. Offline or on a bad connection, the same: the local copy still works,
 * and the next successful load pushes whatever was done in the meantime.
 */
export const useWardrobeBackup = () => {
    const { user } = useAuth();

    // The planner reads localStorage the moment its script parses, so it must
    // not be mounted until the account's copy is in place.
    const [ready, setReady] = useState(false);
    const [status, setStatus] = useState(null);
    const [failed, setFailed] = useState(null);

    const dirty = useRef(new Set());
    const timer = useRef(null);
    const uid = useRef(null);
    uid.current = user?.id || null;

    const push = useCallback(async (keys) => {
        const who = uid.current;
        if (!who || !keys.length) return;

        const locals = readLocal(window.localStorage);
        const stamp = new Date().toISOString();
        const rows = keys
            .filter((k) => WARDROBE_KEYS.includes(k) && locals[k] !== undefined)
            .map((k) => ({ user_id: who, key: k, value: locals[k], updated_at: stamp }));

        if (!rows.length) return;

        const { error } = await supabase
            .from('wardrobe_state')
            .upsert(rows, { onConflict: 'user_id,key' });

        if (error) throw error;

        // Only now is this browser in agreement with the account. Writing the
        // mark before the write lands would make a failed save look settled.
        window.localStorage.setItem(META_KEY, stamp);
    }, []);

    const flush = useCallback(async () => {
        const keys = [...dirty.current];
        if (!keys.length) return;
        dirty.current.clear();
        try {
            await push(keys);
            setFailed(null);
            setStatus('Saved.');
        } catch (err) {
            // Put them back. A save that failed is still work that needs saving.
            keys.forEach((k) => dirty.current.add(k));
            setFailed(err?.message || 'could not save');
        }
    }, [push]);

    /** The planner just wrote a key. */
    const note = useCallback((key) => {
        if (!uid.current || !WARDROBE_KEYS.includes(key)) return;
        dirty.current.add(key);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => { flush(); }, 1200);
    }, [flush]);

    // The first pass: reconcile, then let the planner start.
    useEffect(() => {
        let alive = true;

        if (!user) {
            setReady(true);
            setStatus(null);
            return undefined;
        }

        (async () => {
            try {
                const { data, error } = await supabase
                    .from('wardrobe_state')
                    .select('key,value,updated_at')
                    .eq('user_id', user.id);
                if (error) throw error;

                const rows = data || [];
                const locals = readLocal(window.localStorage);
                const syncedAt = window.localStorage.getItem(META_KEY);
                const move = plan({ locals, rows, syncedAt });

                const byKey = {};
                rows.forEach((r) => { byKey[r.key] = r; });
                move.pull.forEach((k) => writeLocal(window.localStorage, k, byKey[k].value));

                await push(move.push);
                if (!move.push.length) window.localStorage.setItem(META_KEY, new Date().toISOString());

                if (!alive) return;
                setFailed(null);
                setStatus(describeSync(move, closetSize(readLocal(window.localStorage).closets)));
            } catch (err) {
                if (!alive) return;
                // The planner still works. It just is not backed up yet, and
                // saying so plainly is better than a silent gold line.
                setFailed(err?.message || 'could not reach your account');
            } finally {
                if (alive) setReady(true);
            }
        })();

        return () => { alive = false; };
    }, [user, push]);

    // A tab closed two seconds after an edit should not lose it.
    useEffect(() => {
        const leaving = () => { if (document.visibilityState === 'hidden') flush(); };
        document.addEventListener('visibilitychange', leaving);
        window.addEventListener('pagehide', flush);
        return () => {
            document.removeEventListener('visibilitychange', leaving);
            window.removeEventListener('pagehide', flush);
            clearTimeout(timer.current);
        };
    }, [flush]);

    return { ready, status, failed, note, backedUp: Boolean(user) };
};

export default useWardrobeBackup;
