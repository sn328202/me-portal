import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Planning a day somewhere.
 *
 * All the geography happens on the server — geocoding the area, measuring
 * distances, ordering the stops — because the Places key cannot come near the
 * browser and the routing wants to be identical every time.
 */
const post = async (body) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('You are signed out — sign in again.');

    const response = await fetch('/api/itinerary', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'That did not work.');
    return data;
};

export const useItinerary = () => {
    const [area, setArea] = useState(null);
    const [spots, setSpots] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [suggestionsAvailable, setSuggestionsAvailable] = useState(true);
    const [searching, setSearching] = useState(false);
    const [building, setBuilding] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    const search = useCallback(async (near, keyword) => {
        if (!near?.trim()) return;
        setSearching(true);
        setError(null);
        setResult(null);
        try {
            const data = await post({ near: near.trim(), keyword: keyword || undefined });
            if (!data.ok) {
                setError(data.error);
                setArea(null);
                setSpots([]);
                setSuggestions([]);
                return;
            }
            setArea(data.area);
            setSpots(data.spots || []);
            setSuggestions(data.suggestions || []);
            setSuggestionsAvailable(data.suggestionsAvailable);
        } catch (err) {
            setError(err.message);
        } finally {
            setSearching(false);
        }
    }, []);

    const build = useCallback(async ({ title, date, near, spotIds, newPlaces }) => {
        setBuilding(true);
        setError(null);
        try {
            const data = await post({ build: { title, date, near, spotIds, newPlaces } });
            setResult(data);
            return data;
        } catch (err) {
            setError(err.message);
            return null;
        } finally {
            setBuilding(false);
        }
    }, []);

    const reset = useCallback(() => {
        setArea(null); setSpots([]); setSuggestions([]); setResult(null); setError(null);
    }, []);

    return {
        area, spots, suggestions, suggestionsAvailable,
        searching, building, error, result,
        search, build, reset,
    };
};
