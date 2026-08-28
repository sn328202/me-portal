import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Ideas, before they are plans.
 *
 * Everything else in the Atlas needs a date: a day item hangs off a day, a stay
 * hangs off two. But an idea arrives long before there is a date to hang it on
 * — a restaurant someone mentioned, a hotel seen in a photo — and forcing it to
 * choose a Tuesday before it can be written down is how it ends up in a note on
 * a phone instead.
 *
 * So an idea needs only a title. Everything else is optional, and the point at
 * which it acquires a date is the point at which it stops being an idea:
 * `promote` moves it onto a day or into the lodging list and marks it as gone
 * across, without deleting the note it started as.
 *
 * Three piles, not two. Where to eat was going in with things to do, where a
 * restaurant someone mentioned sat between a houseboat and a shopping trip and
 * could not be found again when the question was "where shall we eat".
 */

const KINDS = ['do', 'eat', 'stay'];

export const useTripIdeas = (tripId) => {
    const { user } = useAuth();
    const [ideas, setIdeas] = useState([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        if (!user || !tripId) { setIdeas([]); return; }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('atlas_ideas').select('*')
                .eq('trip_id', tripId).eq('user_id', user.id)
                .order('sort_order').order('created_at');
            if (error) throw error;
            setIdeas(data || []);
        } catch (err) {
            console.error('Error loading ideas:', err);
        } finally {
            setLoading(false);
        }
    }, [user, tripId]);

    useEffect(() => { load(); }, [load]);

    const addIdea = useCallback(async (idea) => {
        if (!user || !tripId) return null;
        const kind = KINDS.includes(idea.kind) ? idea.kind : 'do';
        const row = {
            trip_id: tripId,
            user_id: user.id,
            kind,
            title: String(idea.title || '').trim(),
            notes: idea.notes || null,
            url: idea.url || null,
            cost: idea.cost === '' || idea.cost == null ? null : Number(idea.cost),
            area: idea.area || null,
            sort_order: ideas.filter((i) => i.kind === kind).length,
        };
        if (!row.title) return null;

        const { data, error } = await supabase
            .from('atlas_ideas').insert([row]).select().single();
        if (error) { console.error('Error adding idea:', error); return null; }
        setIdeas((prev) => [...prev, data]);
        return data;
    }, [user, tripId, ideas]);

    const updateIdea = useCallback(async (id, patch) => {
        if (!user) return;
        const before = ideas.find((i) => i.id === id);
        setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
        const { error } = await supabase
            .from('atlas_ideas').update(patch).eq('id', id).eq('user_id', user.id);
        if (error) {
            setIdeas((prev) => prev.map((i) => (i.id === id ? before : i)));
            console.error('Error updating idea:', error);
        }
    }, [user, ideas]);

    const deleteIdea = useCallback(async (id) => {
        if (!user) return;
        setIdeas((prev) => prev.filter((i) => i.id !== id));
        await supabase.from('atlas_ideas').delete().eq('id', id).eq('user_id', user.id);
    }, [user]);

    /**
     * Mark an idea as having become a real plan.
     *
     * The idea is kept rather than deleted: the note explaining *why* it was a
     * good idea is often the useful part, and it is not carried over by a day
     * item that has room only for a title.
     */
    const markPromoted = useCallback(
        (id) => updateIdea(id, { promoted_at: new Date().toISOString() }),
        [updateIdea]
    );

    const unpromote = useCallback((id) => updateIdea(id, { promoted_at: null }), [updateIdea]);

    return {
        ideas,
        loading,
        toDo: ideas.filter((i) => i.kind === 'do'),
        toEat: ideas.filter((i) => i.kind === 'eat'),
        toStay: ideas.filter((i) => i.kind === 'stay'),
        addIdea,
        updateIdea,
        deleteIdea,
        markPromoted,
        unpromote,
        reload: load,
    };
};
