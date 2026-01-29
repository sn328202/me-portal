import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useAtlas = () => {
    const [trips, setTrips] = useState([]);
    const [waypoints, setWaypoints] = useState({});
    const [loading, setLoading] = useState(true);

    const fetchTrips = async () => {
        setLoading(true);

        // 1. Fetch Trips
        const { data: tripData, error: tripError } = await supabase
            .from('atlas_trips')
            .select('*')
            .order('start_date', { ascending: true });

        if (tripError) {
            console.error('Error fetching trips:', tripError);
            setLoading(false);
            return;
        }

        setTrips(tripData);

        // 2. Fetch Waypoints for all trips (could optimize to fetch on demand, but small data for now)
        const { data: waypointData, error: wpError } = await supabase
            .from('atlas_waypoints')
            .select('*')
            .order('order', { ascending: true });

        if (!wpError && waypointData) {
            // Group by trip_id
            const grouped = waypointData.reduce((acc, wp) => {
                if (!acc[wp.trip_id]) acc[wp.trip_id] = [];
                acc[wp.trip_id].push(wp);
                return acc;
            }, {});
            setWaypoints(grouped);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchTrips();
    }, []);

    const addTrip = async (trip) => {
        const { data, error } = await supabase
            .from('atlas_trips')
            .insert([{
                destination: trip.destination,
                start_date: trip.start_date,
                end_date: trip.end_date,
                status: 'Planned',
                budget: trip.budget || 0,
                image_url: trip.image_url || '',
                notes: trip.notes || '',
                google_photos_url: trip.google_photos_url || '',
                google_sheets_url: trip.google_sheets_url || '',
                links: trip.links || [],
                coordinates: trip.coordinates || null
            }])
            .select()
            .single();

        if (error) {
            console.error("Error adding trip:", error);
            return null;
        }

        setTrips(prev => [...prev, data]);
        return data;
    };

    const updateTrip = async (id, updates) => {
        // Optimistic
        setTrips(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

        const { error } = await supabase
            .from('atlas_trips')
            .update(updates)
            .eq('id', id);

        if (error) {
            console.error("Error updating trip:", error);
            fetchTrips(); // Revert
        }
    };

    const deleteTrip = async (id) => {
        setTrips(prev => prev.filter(t => t.id !== id));
        // Waypoints cascade delete automatically via DB FK constraint
        await supabase.from('atlas_trips').delete().eq('id', id);
    };

    const addWaypoint = async (tripId, waypoint) => {
        // Optimistic
        const tempId = Date.now();
        const newWp = { ...waypoint, id: tempId, trip_id: tripId };

        setWaypoints(prev => ({
            ...prev,
            [tripId]: [...(prev[tripId] || []), newWp]
        }));

        const { data, error } = await supabase
            .from('atlas_waypoints')
            .insert([{
                trip_id: tripId,
                name: waypoint.name,
                lat: waypoint.lat,
                lng: waypoint.lng,
                order: (waypoints[tripId]?.length || 0) + 1
            }])
            .select()
            .single();

        if (error) {
            console.error("Error adding waypoint:", error);
            // Revert
            setWaypoints(prev => ({
                ...prev,
                [tripId]: prev[tripId].filter(w => w.id !== tempId)
            }));
            return;
        }

        // Replace temp
        setWaypoints(prev => ({
            ...prev,
            [tripId]: prev[tripId].map(w => w.id === tempId ? data : w)
        }));
    };

    const updateWaypoint = async (id, tripId, updates) => {
        setWaypoints(prev => ({
            ...prev,
            [tripId]: prev[tripId].map(w => w.id === id ? { ...w, ...updates } : w)
        }));

        const { error } = await supabase
            .from('atlas_waypoints')
            .update(updates)
            .eq('id', id);

        if (error) console.error("Error updating waypoint:", error);
    };

    const deleteWaypoint = async (id, tripId) => {
        setWaypoints(prev => ({
            ...prev,
            [tripId]: prev[tripId].filter(w => w.id !== id)
        }));

        const { error } = await supabase
            .from('atlas_waypoints')
            .delete()
            .eq('id', id);

        if (error) console.error("Error deleting waypoint:", error);
    };

    return { trips, waypoints, addTrip, updateTrip, deleteTrip, addWaypoint, updateWaypoint, deleteWaypoint, loading };
};
