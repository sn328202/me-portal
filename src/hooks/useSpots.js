import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Put a saved spot onto a day itinerary, keeping the link back to it so the
 * two records cannot drift.
 *
 * Standalone rather than part of the hook because the day planner needs only
 * this. Calling useSpots() there as well would open a second realtime channel
 * under the same name and refetch the whole library for nothing.
 */
export const addSpotToPlan = async (spot, planId, userId) => {
    if (!userId || !planId || !spot) return null;
    const { data, error } = await supabase.from('plan_items').insert([{
        plan_id: planId,
        spot_id: spot.id,
        activity: spot.name,
        location: spot.address || spot.neighborhood || spot.city || null,
        link: spot.maps_url || null,
        notes: spot.why || null,
        is_brainstorm: true,
        user_id: userId,
    }]).select().single();
    if (error) {
        console.error('Could not add the spot to that plan:', error.message);
        return null;
    }
    return data;
};

/**
 * Saved places — somewhere she wants to go, independent of any particular day.
 *
 * Before this existed, a spoken restaurant became a brand-new one-item day
 * plan, so the Daydream filled up with throwaway itineraries and the place
 * itself had nowhere to live between wanting to go and going.
 */
export const useSpots = () => {
    const { user } = useAuth();
    const [spots, setSpots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchSpots = useCallback(async () => {
        if (!user) {
            setSpots([]);
            setLoading(false);
            return;
        }
        try {
            const { data, error: err } = await supabase
                .from('spots')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (err) throw err;
            setSpots(data || []);
            setError(null);
        } catch (err) {
            setError(err.message || 'Could not load your spots');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchSpots(); }, [fetchSpots]);

    // A spot spoken into the phone should appear here without a refresh.
    useEffect(() => {
        if (!user) return undefined;
        const channel = supabase
            .channel('spots-feed')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'spots', filter: `user_id=eq.${user.id}` },
                (payload) => setSpots((prev) => (
                    prev.some((s) => s.id === payload.new.id) ? prev : [payload.new, ...prev]
                ))
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user]);

    /** Look the place up server-side, then save whatever came back. */
    const addSpot = async ({ name, city, why, category, tags }) => {
        if (!user) throw new Error('Not authenticated');

        let place = null;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch('/api/resolve-place', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    Authorization: `Bearer ${session?.access_token || ''}`,
                },
                body: JSON.stringify({ name, city }),
            });
            const json = await response.json();
            if (json.ok) place = json.place;
        } catch {
            // The lookup is a convenience. Losing it must not stop her saving
            // the place.
        }

        const row = {
            name: place?.name || name,
            category: category || place?.category || null,
            why: why || null,
            address: place?.address || null,
            neighborhood: place?.neighborhood || null,
            city: place?.city || city || null,
            lat: place?.lat ?? null,
            lng: place?.lng ?? null,
            maps_url: place?.maps_url || null,
            place_id: place?.place_id || null,
            website: place?.website || null,
            phone: place?.phone || null,
            rating: place?.rating ?? null,
            price_level: place?.price_level ?? null,
            hours: place?.hours || null,
            image_url: place?.image_url || null,
            tags: tags && tags.length ? tags : [],
            status: 'want to go',
            source: 'manual',
            user_id: user.id,
        };

        const { data, error: err } = await supabase.from('spots').insert([row]).select().single();
        if (err) throw err;
        setSpots((prev) => [data, ...prev]);
        return data;
    };

    const updateSpot = async (id, patch) => {
        if (!user) return;
        setSpots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
        const { error: err } = await supabase
            .from('spots').update(patch).eq('id', id).eq('user_id', user.id);
        if (err) {
            setError(err.message);
            fetchSpots();   // put the optimistic change back if it did not stick
        }
    };

    const toggleVisited = (spot) => updateSpot(spot.id, {
        status: spot.status === 'been' ? 'want to go' : 'been',
        visited_at: spot.status === 'been' ? null : new Date().toISOString(),
    });

    const deleteSpot = async (id) => {
        if (!user) return;
        setSpots((prev) => prev.filter((s) => s.id !== id));
        await supabase.from('spots').delete().eq('id', id).eq('user_id', user.id);
    };

    return { spots, loading, error, addSpot, updateSpot, toggleVisited, deleteSpot, refresh: fetchSpots };
};
