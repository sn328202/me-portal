import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCaptureRevision } from '../contexts/CaptureContext';

/**
 * The Commonplace — things saved from elsewhere, turned into something doable.
 *
 * The rooms hold structured data (a recipe's ingredients, a spot's address).
 * This holds the other half: the checklist, whether she worked through it, and
 * what she thought of it afterwards. A saved TikTok can be both.
 */
export const usePlans = () => {
    const { user } = useAuth();
    const revision = useCaptureRevision();
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchPlans = useCallback(async () => {
        if (!user) {
            setPlans([]);
            setLoading(false);
            return;
        }
        try {
            const { data, error: err } = await supabase
                .from('plans')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (err) throw err;
            setPlans(data || []);
            setError(null);
        } catch (err) {
            setError(err.message || 'Could not open the Commonplace');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchPlans(); }, [fetchPlans, revision]);

    /** Optimistic, with a refetch if the write is refused. */
    const patch = useCallback(async (id, changes) => {
        setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes } : p)));
        const { error: err } = await supabase
            .from('plans').update(changes).eq('id', id).eq('user_id', user.id);
        if (err) {
            setError(err.message);
            fetchPlans();
        }
    }, [user, fetchPlans]);

    const toggleStep = useCallback((plan, index) => {
        const steps = (plan.steps || []).map((s, i) => (i === index ? { ...s, done: !s.done } : s));
        const anyDone = steps.some((s) => s.done);
        const allDone = steps.length > 0 && steps.every((s) => s.done);

        // Status follows the checklist rather than needing its own bookkeeping:
        // ticking the first step starts it, ticking the last finishes it.
        const status = allDone ? 'done' : anyDone ? 'doing' : 'saved';
        return patch(plan.id, {
            steps,
            status,
            done_at: allDone ? (plan.done_at || new Date().toISOString()) : null,
        });
    }, [patch]);

    const setStatus = useCallback((plan, status) => patch(plan.id, {
        status,
        done_at: status === 'done' ? (plan.done_at || new Date().toISOString()) : null,
        // Marking the whole thing done ticks the remaining steps, so the
        // checklist never contradicts the badge next to it.
        steps: status === 'done'
            ? (plan.steps || []).map((s) => ({ ...s, done: true }))
            : plan.steps,
    }), [patch]);

    const rate = useCallback((plan, rating) => patch(plan.id, {
        rating: plan.rating === rating ? null : rating,
    }), [patch]);

    const setNotes = useCallback((plan, notes) => patch(plan.id, { notes }), [patch]);
    const setReminder = useCallback((plan, remindAt) => patch(plan.id, {
        remind_at: remindAt || null,
        reminded_at: null,
    }), [patch]);

    const remove = useCallback(async (id) => {
        setPlans((prev) => prev.filter((p) => p.id !== id));
        await supabase.from('plans').delete().eq('id', id).eq('user_id', user.id);
    }, [user]);

    return {
        plans, loading, error, refresh: fetchPlans,
        toggleStep, setStatus, rate, setNotes, setReminder, remove,
    };
};
