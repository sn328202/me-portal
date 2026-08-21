import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

/**
 * One place to send a thought, from anywhere in the app.
 *
 * The same endpoint the phone Shortcut talks to, authenticated with the
 * signed-in session instead of the shared token — a secret shipped to the
 * browser is not a secret.
 *
 * `revision` is the interesting part: every hook that reads a table capture can
 * write to includes it in its fetch dependencies, so typing "we need oat milk"
 * on the Atlas page updates the grocery list without a refresh and without
 * every hook needing its own realtime subscription.
 */

const CaptureContext = createContext(null);

// Children before parents, so a plan_item is gone before the day_plan that
// owns it. Recipe ingredients and plan items cascade, but the order costs
// nothing and protects anything added later that does not.
const CHILD_TABLES = ['plan_items', 'ingredients'];

export const CaptureProvider = ({ children }) => {
    const { user } = useAuth();
    const [pending, setPending] = useState(false);
    const [result, setResult] = useState(null);
    const [revision, setRevision] = useState(0);
    // Guards against a second submit while the first is still in flight —
    // double-filing the same thought is the one mistake with no undo path.
    const inFlight = useRef(false);

    const submit = useCallback(async (text) => {
        const trimmed = (text || '').trim();
        if (!trimmed || inFlight.current) return null;

        inFlight.current = true;
        setPending(true);
        setResult(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('You are signed out — sign in again.');

            const response = await fetch('/api/capture', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ text: trimmed, source: 'web' }),
            });

            const data = await response.json();
            if (!response.ok && !data.wrote) {
                throw new Error(data.error || 'That did not go through.');
            }

            const outcome = {
                summary: data.summary,
                actions: data.actions || [],
                duplicates: data.duplicates || [],
                captureId: data.captureId,
                transcript: trimmed,
                undone: false,
                error: data.error || null,
            };
            setResult(outcome);
            // Only disturb the rest of the app when something actually landed.
            if (outcome.actions.length) setRevision((n) => n + 1);
            return outcome;
        } catch (err) {
            setResult({ summary: null, actions: [], error: err.message, transcript: trimmed });
            return null;
        } finally {
            inFlight.current = false;
            setPending(false);
        }
    }, []);

    /** Remove everything a capture wrote, then mark it undone. */
    const undo = useCallback(async () => {
        if (!result || !user || !result.actions?.length) return;

        const ordered = [...result.actions].sort(
            (a, b) => (CHILD_TABLES.includes(b.table) ? 1 : 0) - (CHILD_TABLES.includes(a.table) ? 1 : 0)
        );

        for (const action of ordered) {
            if (!action.table || !action.id) continue;
            const { error } = await supabase
                .from(action.table).delete().eq('id', action.id).eq('user_id', user.id);
            if (error) {
                setResult((prev) => ({ ...prev, error: `Could not undo: ${error.message}` }));
                return;
            }
        }

        if (result.captureId) {
            await supabase.from('captures')
                .update({ undone: true }).eq('id', result.captureId).eq('user_id', user.id);
        }

        setResult((prev) => ({ ...prev, undone: true, summary: 'Undone.' }));
        setRevision((n) => n + 1);
    }, [result, user]);

    const dismiss = useCallback(() => setResult(null), []);

    return (
        <CaptureContext.Provider value={{ submit, undo, dismiss, pending, result, revision }}>
            {children}
        </CaptureContext.Provider>
    );
};

/**
 * Just the revision counter, and safe to call outside the provider — a hook
 * used by a page that has not been wrapped should keep working, not throw.
 * Add it to a fetch effect's dependencies and that data refreshes whenever a
 * capture writes something.
 */
export const useCaptureRevision = () => useContext(CaptureContext)?.revision ?? 0;

export const useCapture = () => {
    const ctx = useContext(CaptureContext);
    if (!ctx) throw new Error('useCapture must be used inside <CaptureProvider>');
    return ctx;
};
