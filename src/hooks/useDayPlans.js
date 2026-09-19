import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { replanFor } from '../../api/_cookPlan.js';

/**
 * The cooking schedule for a day on the meal plan.
 *
 * The same thing a menu carries, hung off a date instead: when she is serving
 * that day, and the order to cook that day's recipes in so all of it lands at
 * once. One row per day, like the meal plan itself.
 *
 * Only today onwards is read. Yesterday's schedule is a record of a dinner
 * that already happened, and the planner starts clean each morning for the
 * same reason the meal plan does.
 */
export const useDayPlans = () => {
    const { user } = useAuth();
    const [days, setDays] = useState({});      // keyed by 'YYYY-MM-DD'
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState(null);

    const fetchDays = useCallback(async () => {
        if (!user) { setDays({}); setLoading(false); return; }
        setLoading(true);
        const today = new Date();
        const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const { data, error } = await supabase
            .from('user_meal_day_plans')
            .select('*')
            .eq('user_id', user.id)
            .gte('date', iso);

        if (error) {
            console.error('Error fetching day plans:', error);
        } else {
            const byDate = {};
            (data || []).forEach((row) => { byDate[row.date] = row; });
            setDays(byDate);
        }
        setLoading(false);
    }, [user]);

    /* Deferred by a microtask rather than called straight out of the effect:
       the first thing the fetch does is set state, and doing that synchronously
       inside an effect makes React render twice before it has anything. */
    useEffect(() => {
        let alive = true;
        Promise.resolve().then(() => { if (alive) fetchDays(); });
        return () => { alive = false; };
    }, [fetchDays]);

    /**
     * When she is serving that day.
     *
     * A schedule already built moves with it rather than going stale: every
     * step keeps its distance from the food going out and the clocks are
     * worked out again, which is cheaper than asking the model a second time
     * and does not quietly rewrite a plan she has already read.
     */
    const setServeTime = useCallback(async (date, serveTime) => {
        if (!user || !date) return null;
        const had = days[date];
        const plan = replanFor(had?.plan, { serve_date: date, serve_time: serveTime });

        const row = {
            user_id: user.id,
            date,
            serve_time: serveTime || null,
            plan: plan || null,
        };

        const { data, error } = await supabase
            .from('user_meal_day_plans')
            .upsert(row, { onConflict: 'user_id, date' })
            .select()
            .single();

        if (error) {
            console.error('Error saving serve time:', error);
            setNotice("Couldn't save that time. Try again.");
            return null;
        }
        setDays((prev) => ({ ...prev, [date]: data }));
        return plan;
    }, [user, days]);

    /** The schedule itself — built, edited, or ticked off a step at a time. */
    const savePlan = useCallback(async (date, plan) => {
        if (!user || !date) return;
        const { data, error } = await supabase
            .from('user_meal_day_plans')
            .upsert({
                user_id: user.id,
                date,
                serve_time: plan?.serve_time || null,
                plan: plan || null,
            }, { onConflict: 'user_id, date' })
            .select()
            .single();

        if (error) {
            console.error('Error saving day plan:', error);
            setNotice("Couldn't save that. Try again.");
            return;
        }
        setDays((prev) => ({ ...prev, [date]: data }));
    }, [user]);

    return useMemo(() => ({
        dayPlans: days,
        loading,
        notice,
        clearNotice: () => setNotice(null),
        setServeTime,
        savePlan,
        refreshDayPlans: fetchDays,
    }), [days, loading, notice, setServeTime, savePlan, fetchDays]);
};
