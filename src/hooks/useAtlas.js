import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useAtlas = () => {
    const { user } = useAuth();
    const [trips, setTrips] = useState([]);
    const [waypoints, setWaypoints] = useState({});
    const [loading, setLoading] = useState(true);

    const fetchTrips = async () => {
        if (!user) {
            setTrips([]);
            setWaypoints({});
            setLoading(false);
            return;
        }

        setLoading(true);

        // 1. Fetch Trips
        const { data: tripData, error: tripError } = await supabase
            .from('atlas_trips')
            .select('*')
            .eq('user_id', user.id)
            .order('start_date', { ascending: true });

        if (tripError) {
            console.error('Error fetching trips:', tripError);
            setLoading(false);
            return;
        }

        const currentTrips = tripData || [];
        setTrips(currentTrips);

        // 2. Fetch Waypoints for these trips
        const tripIds = currentTrips.map(t => t.id);

        if (tripIds.length > 0) {
            const { data, error: waypointError } = await supabase
                .from('atlas_waypoints')
                .select('*')
                .in('trip_id', tripIds)
                .order('order', { ascending: true });

            if (data) {
                const grouped = data.reduce((acc, wp) => {
                    if (!acc[wp.trip_id]) acc[wp.trip_id] = [];
                    acc[wp.trip_id].push(wp);
                    return acc;
                }, {});
                setWaypoints(grouped);
            } else {
                // Don't silently keep stale waypoints when the query fails
                console.error('Error fetching waypoints:', waypointError);
            }
        } else {
            setWaypoints({});
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchTrips();
    }, [user]);

    const addTrip = async (trip) => {
        if (!user) return null;

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
                coordinates: trip.coordinates || null,
                user_id: user.id
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
        if (!user) return;

        // Optimistic
        setTrips(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

        const { error } = await supabase
            .from('atlas_trips')
            .update(updates)
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            console.error("Error updating trip:", error);
            fetchTrips(); // Revert
        }
    };

    const deleteTrip = async (id) => {
        if (!user) return;

        setTrips(prev => prev.filter(t => t.id !== id));
        // Waypoints cascade delete automatically via DB FK constraint
        await supabase.from('atlas_trips').delete().eq('id', id).eq('user_id', user.id);
    };

    const addWaypoint = async (tripId, waypoint) => {
        if (!user) return;

        // Verify ownership: ensure tripId exists in our user-filtered trips
        if (!trips.find(t => t.id === tripId)) {
            console.error("Access denied: Trip not found or not owned.");
            return;
        }

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
                order: (waypoints[tripId]?.length || 0) + 1,
                user_id: user.id
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
        if (!user) return;
        if (!trips.find(t => t.id === tripId)) return;

        setWaypoints(prev => ({
            ...prev,
            [tripId]: prev[tripId].map(w => w.id === id ? { ...w, ...updates } : w)
        }));

        const { error } = await supabase
            .from('atlas_waypoints')
            .update(updates)
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) console.error("Error updating waypoint:", error);
    };

    const deleteWaypoint = async (id, tripId) => {
        if (!user) return;
        if (!trips.find(t => t.id === tripId)) return;

        setWaypoints(prev => ({
            ...prev,
            [tripId]: prev[tripId].filter(w => w.id !== id)
        }));

        const { error } = await supabase
            .from('atlas_waypoints')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) console.error("Error deleting waypoint:", error);
    };

    return { trips, waypoints, addTrip, updateTrip, deleteTrip, addWaypoint, updateWaypoint, deleteWaypoint, loading };
};
