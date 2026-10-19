import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usdOf, needsRate, currencyOf, balances, settleUp, bucketOf } from '../utils/money';

const dayLabel = (d) => new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
});

/** Every priced thing on a trip — day cards and hotel stays — as one list. */
export const costsOf = (days = [], itemsByDay = {}, stays = []) => {
    const out = [];
    const dateOf = Object.fromEntries(days.map((d) => [d.id, String(d.date).slice(0, 10)]));
    for (const [dayId, list] of Object.entries(itemsByDay)) {
        for (const it of list || []) {
            const priced = it.cost !== null && it.cost !== undefined && it.cost !== '' && Number(it.cost) !== 0;
            // A real booking with no price yet is listed too, so its amount
            // can be filled in here.
            const booked = it.booked_id || it.journey_id || it.gig_id;
            if (!priced && !booked) continue;
            out.push({
                key: `item:${it.id}`, source: 'item', id: it.id, dayId: Number(dayId) || dayId,
                date: dateOf[dayId] || null, title: it.title || 'Something', row: it,
            });
        }
    }
    for (const st of stays) {
        if (!(Number(st.cost) > 0)) continue;
        out.push({ key: `stay:${st.id}`, source: 'stay', id: st.id, date: st.check_in, title: st.name, row: st });
    }
    return out
        .map((c) => ({
            ...c,
            when: c.date ? dayLabel(c.date) : '',
            amount: c.row.cost === null || c.row.cost === undefined || c.row.cost === '' ? null : Number(c.row.cost),
            currency: currencyOf(c.row),
            usd: usdOf(c.row),
            needsRate: needsRate(c.row),
            bucket: bucketOf(c),
        }))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
};

/**
 * Who paid what on one trip: the priced things, their USD value, each one's
 * payers and shares, and everyone's balance. Fetches a rate for anything
 * charged in another currency that does not have one yet.
 */
export const useTripMoney = (trip, planner) => {
    const { user } = useAuth();
    const [splits, setSplits] = useState({});
    const [rateNote, setRateNote] = useState(null);
    const asked = useRef(new Set());
    const tripId = trip?.id ?? null;
    const travelers = useMemo(() => (trip?.travelers || []).filter(Boolean), [trip?.travelers]);
    const rules = useMemo(() => (Array.isArray(trip?.cover_rules) ? trip.cover_rules : []), [trip?.cover_rules]);

    const load = useCallback(async () => {
        if (!user || !tripId) return;
        try {
            const { data, error } = await supabase.from('cost_splits').select('*')
                .eq('trip_id', tripId).eq('user_id', user.id);
            if (error) throw error;
            setSplits(Object.fromEntries((data || []).map((r) => [`${r.source}:${r.source_id}`, r])));
        } catch (err) {
            console.error('Could not load who paid:', err);
        }
    }, [user, tripId]);

    useEffect(() => { load(); }, [load]);

    const costs = useMemo(
        () => costsOf(planner.days, planner.items, planner.stays)
            .map((c) => ({ ...c, split: splits[c.key] || null })),
        [planner.days, planner.items, planner.stays, splits]
    );

    /** Write a cost's amount, currency and rate back to its own row. */
    const saveCost = useCallback(async (cost, patch) => {
        if (cost.source === 'stay') await planner.updateStay(cost.id, patch);
        else await planner.updateItem(cost.dayId, cost.id, patch);
    }, [planner]);

    /** Fetch USD per unit of a currency on a date. */
    const fetchRate = useCallback(async (currency, date) => {
        const r = await fetch(`/api/fx?from=${encodeURIComponent(currency)}&date=${encodeURIComponent(date || '')}`);
        const json = await r.json();
        if (!json.ok) throw new Error(json.error || 'No rate');
        return json;
    }, []);

    // Anything charged in another currency gets a rate as soon as it is seen.
    useEffect(() => {
        const missing = costs.filter((c) => c.needsRate && !asked.current.has(c.key));
        if (!missing.length) return;
        for (const c of missing) asked.current.add(c.key);
        (async () => {
            const failed = [];
            for (const c of missing) {
                try {
                    const { rate } = await fetchRate(c.currency, c.date);
                    await saveCost(c, { fx_rate: rate, fx_manual: false });
                } catch {
                    failed.push(`${c.title} (${c.currency})`);
                }
            }
            setRateNote(failed.length ? `No rate found for ${failed.join(', ')}. Open it and type the USD amount.` : null);
        })();
    }, [costs, fetchRate, saveCost]);

    const saveSplit = useCallback(async (cost, { paid, owed }) => {
        if (!user || !tripId) return;
        const row = {
            user_id: user.id, trip_id: tripId, source: cost.source, source_id: String(cost.id),
            paid: paid || [], owed: owed && owed.length ? owed : null, updated_at: new Date().toISOString(),
        };
        setSplits((prev) => ({ ...prev, [cost.key]: { ...prev[cost.key], ...row } }));
        const { error } = await supabase.from('cost_splits').upsert(row, { onConflict: 'source,source_id' });
        if (error) { console.error('Could not save who paid:', error); load(); }
    }, [user, tripId, load]);

    const summary = useMemo(() => {
        const b = balances(costs.map((c) => ({ usd: c.usd, split: c.split, bucket: c.bucket })), travelers, rules);
        return { ...b, settle: settleUp(b.people), unrated: costs.filter((c) => c.usd === null).length };
    }, [costs, travelers, rules]);

    return { costs, travelers, rules, summary, saveCost, saveSplit, fetchRate, rateNote };
};
