import React, { useState, useEffect } from 'react';
import { GiTreasureMap, GiNotebook, GiSandsOfTime, GiPositionMarker, GiFeather, GiHourglass, GiCoins, GiCancel, GiRoughWound } from 'react-icons/gi';
import { useJsApiLoader } from '@react-google-maps/api';
import PlacesSearch from '../components/PlacesSearch';
import SmartTimeInput from '../components/SmartTimeInput';
import { supabase } from '../lib/supabase';
import { generateGoogleCalendarUrl, generateICS, downloadICS } from '../utils/calendarUtils';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { addHours, format, parse, isValid, addMinutes } from 'date-fns';

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const libraries = ['places'];

// Sortable Item Component
const SortableItem = ({ item, children }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {children}
        </div>
    );
};

const PlaceImage = ({ photo, style = {} }) => {
    const [failed, setFailed] = React.useState(false);
    const [loaded, setLoaded] = React.useState(false);

    React.useEffect(() => {
        if (!photo || !photo.url) return;
        const img = new Image();
        img.onload = () => setLoaded(true);
        img.onerror = () => setFailed(true);
        img.src = photo.url;
    }, [photo]);

    if (!photo || failed) {
        return (
            <div style={{
                ...style,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text-muted)'
            }}>
                <GiPositionMarker size={24} style={{ opacity: 0.3 }} />
            </div>
        );
    }

    if (!loaded) return <div style={{ ...style, background: 'rgba(255,255,255,0.05)' }} />;

    return (
        <div style={{
            ...style,
            backgroundImage: `url(${photo.url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
        }} />
    );
};

const DayPlanner = () => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: googleMapsApiKey,
        libraries
    });

    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [items, setItems] = useState([]); // Items for selected plan
    const [deletedItemIds, setDeletedItemIds] = useState([]); // Track items to delete on save
    const [loading, setLoading] = useState(true);
    const [travelTimes, setTravelTimes] = useState({});

    const [deleteConfirm, setDeleteConfirm] = useState(null); // ID of plan pending delete confirmation
    const [processingDelete, setProcessingDelete] = useState(false);

    // Form States
    const [isCreating, setIsCreating] = useState(false); // Creating new plan
    const [newPlan, setNewPlan] = useState({ title: '', location: '', notes: '' });

    const [newItem, setNewItem] = useState({ activity: '', location: '', link: '', cost: '', duration: '', lat: null, lng: null });

    // Local state for editing to avoid auto-save jitter
    const [editedPlan, setEditedPlan] = useState(null);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    useEffect(() => {
        if (selectedPlan) {
            setEditedPlan({ ...selectedPlan });
            setIsDirty(false);
            setDeletedItemIds([]); // Reset deleted items tracking
            fetchItems(selectedPlan.id);
        } else {
            setItems([]);
            setDeletedItemIds([]);
            setEditedPlan(null);
            setIsDirty(false);
        }
    }, [selectedPlan]);

    useEffect(() => {
        if (isLoaded && items.length > 0) {
            calculateTravelTimes();
        }
    }, [items, isLoaded]);

    // Clear delete confirmation if user clicks away or changes selection
    useEffect(() => {
        setDeleteConfirm(null);
    }, [selectedPlan]);

    const calculateTravelTimes = async () => {
        const timelineItems = items.filter(i => !i.is_brainstorm);
        if (timelineItems.length < 2) return;

        const service = new google.maps.DistanceMatrixService();
        const newTravelTimes = {};

        for (let i = 0; i < timelineItems.length - 1; i++) {
            const origin = timelineItems[i].location; // Expecting address string
            const dest = timelineItems[i + 1].location;

            if (!origin || !dest) continue;

            try {
                const response = await service.getDistanceMatrix({
                    origins: [origin],
                    destinations: [dest],
                    travelMode: 'DRIVING', // Default to driving
                });

                if (response.rows[0].elements[0].status === 'OK') {
                    newTravelTimes[timelineItems[i].id] = response.rows[0].elements[0].duration.text;
                }
            } catch (error) {
                console.error("Error calculating distance:", error);
            }
        }
        setTravelTimes(newTravelTimes);
    };

    const fetchPlans = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setPlans([]);
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('day_plans')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) console.error(error);
        else setPlans(data || []);
        setLoading(false);
    };

    const fetchItems = async (planId) => {
        const { data, error } = await supabase.from('plan_items').select('*').eq('plan_id', planId);
        if (error) console.error(error);
        else {
            // Enforce chronological sort immediately upon fetching
            const sorted = sortItems(data || []);
            setItems(sorted);
        }
    };

    const createPlan = async () => {
        if (!newPlan.title) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            alert("You must be logged in to create a plan.");
            return;
        }

        const { data, error } = await supabase
            .from('day_plans')
            .insert([{
                ...newPlan,
                planned_date: newPlan.planned_date || null,
                status: 'Idea',
                user_id: user.id
            }])
            .select();

        if (error) {
            alert('Failed to formulate plan.');
        } else {
            setPlans([data[0], ...plans]);
            setSelectedPlan(data[0]);
            setIsCreating(false);
            setNewPlan({ title: '', location: '', notes: '', planned_date: null });
        }
    };



    // Helper to sort items by start_time
    const sortItems = (itemsList) => {
        return [...itemsList].sort((a, b) => {
            if (a.is_brainstorm && !b.is_brainstorm) return 1;
            if (!a.is_brainstorm && b.is_brainstorm) return -1;
            if (a.is_brainstorm && b.is_brainstorm) return 0; // Keep order for brainstorm

            // For timeline items, sort by time
            if (!a.start_time) return 1;
            if (!b.start_time) return -1;
            // Handle potentially different time formats (though we try to enforce HH:mm:ss)
            return a.start_time.localeCompare(b.start_time);
        });
    };

    // DND Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex(i => i.id === active.id);
                const newIndex = items.findIndex(i => i.id === over.id);

                // 1. Move the item in the array
                const newItems = arrayMove(items, oldIndex, newIndex);

                // 2. Smart Time Adjustment
                // Get the item itself
                const activeItem = newItems[newIndex];

                // Get neighbors in the TIMELINE list (exclude brainstorm)
                const timelineItems = newItems.filter(i => !i.is_brainstorm);
                const activeTimelineIndex = timelineItems.findIndex(i => i.id === active.id);

                const prevItem = activeTimelineIndex > 0 ? timelineItems[activeTimelineIndex - 1] : null;

                let newStartTime = activeItem.start_time;

                if (prevItem && prevItem.start_time) {
                    // Start after previous item ends
                    try {
                        const prevStart = parse(prevItem.start_time, 'HH:mm:ss', new Date());
                        let prevEnd;

                        // Add duration or default 1 hour
                        if (prevItem.duration) {
                            // Format is likely "X hours" or just a number or HH:MM? 
                            // Let's assume HH:MM or simple string for now.
                            // If it's just a string like "2 hours", this parsing might fail.
                            // The duration input type was not specified strictly.
                            // Let's safe guard.
                            const durationMatch = prevItem.duration.match(/(\d+)/);
                            if (prevItem.duration.includes(':')) {
                                const [h, m] = prevItem.duration.split(':').map(Number);
                                prevEnd = new Date(prevStart.getTime() + (h * 60 * 60 * 1000) + (m * 60 * 1000));
                            } else if (durationMatch) {
                                // Assume hours if just a number? Or minutes? 
                                // Let's assume hours for simplicity in itinerary context
                                prevEnd = addHours(prevStart, parseInt(durationMatch[0]));
                            } else {
                                prevEnd = addHours(prevStart, 1);
                            }
                        } else {
                            // Default gap: 1 hour
                            prevEnd = addHours(prevStart, 1);
                        }

                        newStartTime = format(prevEnd, 'HH:mm:ss');

                    } catch (e) {
                        console.error("Time calc error", e);
                    }
                } else if (!prevItem) {
                    // First item: Default to 9am
                    newStartTime = '09:00:00';
                }

                // Update the moved item's time
                newItems[newIndex] = { ...activeItem, start_time: newStartTime };

                // CRITICAL: Re-sort based on the new times to ensure chronology
                // This prevents "18:00 before 15:00" scenarios if the drop target wasn't perfect
                const reSorted = sortItems(newItems);

                setIsDirty(true);
                return reSorted;
            });
        }
    };

    const deleteItem = async (id) => {
        // Just remove from local state
        setItems(items.filter(i => i.id !== id));

        // If it's a real item (not a temp one), mark for deletion
        if (typeof id === 'number' || (typeof id === 'string' && !id.startsWith('temp-'))) {
            setDeletedItemIds([...deletedItemIds, id]);
        }
        setIsDirty(true);
    };

    const deletePlan = async (e, id) => {
        if (e) e.stopPropagation();

        if (deleteConfirm !== id) {
            setDeleteConfirm(id);
            setTimeout(() => setDeleteConfirm(null), 3000);
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setProcessingDelete(true);

        const { error: itemsError } = await supabase.from('plan_items').delete().eq('plan_id', id);
        if (itemsError) {
            console.error("Error deleting items:", itemsError);
            alert("Error clearing itinerary items.");
            setProcessingDelete(false);
            return;
        }

        const { error } = await supabase.from('day_plans').delete().eq('id', id).eq('user_id', user.id);
        if (error) {
            console.error("Error deleting plan:", error);
            alert("Failed to delete plan: " + error.message);
        } else {
            setPlans(plans.filter(p => p.id !== id));
            if (selectedPlan?.id === id) setSelectedPlan(null);
            setDeleteConfirm(null);
        }
        setProcessingDelete(false);
    };

    const updateItem = async (id, updates) => {
        // Update local state ONLY
        let updatedItems = items.map(i => i.id === id ? { ...i, ...updates } : i);

        // If start_time changed, re-sort
        if (updates.start_time) {
            updatedItems = sortItems(updatedItems);
        }

        setItems(updatedItems);
        setIsDirty(true);
    };

    const moveItemToTimeline = async (id) => {
        await updateItem(id, { is_brainstorm: false, start_time: '09:00:00' });
    };

    const handlePlanChange = (field, value) => {
        setEditedPlan(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const saveChanges = async () => {
        if (!editedPlan) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Save Plan Details
        const { id, title, location, planned_date, notes } = editedPlan;
        const { data: planData, error: planError } = await supabase
            .from('day_plans')
            .update({
                title,
                location,
                planned_date: planned_date || null,
                notes
            })
            .eq('id', id)
            .eq('user_id', user.id)
            .select();

        if (planError) {
            console.error("Error saving plan details:", planError);
            alert("Failed to save plan details.");
            return;
        }

        // 2. Process Deletions
        if (deletedItemIds.length > 0) {
            const { error: deleteError } = await supabase
                .from('plan_items')
                .delete()
                .in('id', deletedItemIds);

            if (deleteError) {
                console.error("Error deleting items:", deleteError);
            } else {
                setDeletedItemIds([]);
            }
        }

        // 3. Process Upserts (New & Updated Items)
        // CRITICAL: Sort items by time BEFORE saving order to ensure consistency
        const sortedItemsForSave = sortItems(items);

        // Assign sort_order based on sorted index
        const itemsWithSortOrder = sortedItemsForSave.map((item, index) => ({
            ...item,
            sort_order: index
        }));

        const newItems = itemsWithSortOrder.filter(i => typeof i.id === 'string' && i.id.startsWith('temp-'));
        const existingItems = itemsWithSortOrder.filter(i => !(typeof i.id === 'string' && i.id.startsWith('temp-')));

        // Updates
        if (existingItems.length > 0) {
            const { error: updateError } = await supabase
                .from('plan_items')
                .upsert(existingItems.map(i => ({
                    // Map relevant fields, ensuring we don't send extra UI state if any
                    id: i.id,
                    plan_id: selectedPlan.id,
                    activity: i.activity,
                    location: i.location,
                    link: i.link,
                    notes: i.notes,
                    cost: i.cost === '' ? null : i.cost,
                    duration: i.duration === '' ? null : i.duration,
                    start_time: i.start_time === '' ? null : i.start_time,
                    sort_order: i.sort_order, // Save sort order
                    is_brainstorm: i.is_brainstorm,
                    place_id: i.place_id,
                    place_data: i.place_data
                })));

            if (updateError) {
                console.error("Error updating items:", updateError);
                alert("Failed to save some items: " + updateError.message);
                return;
            }
        }

        // Inserts
        if (newItems.length > 0) {
            const { error: insertError } = await supabase
                .from('plan_items')
                .insert(newItems.map(i => ({
                    plan_id: selectedPlan.id,
                    activity: i.activity,
                    location: i.location,
                    link: i.link,
                    notes: i.notes,
                    cost: i.cost === '' ? null : i.cost,
                    duration: i.duration === '' ? null : i.duration,
                    start_time: i.start_time === '' ? null : i.start_time,
                    sort_order: i.sort_order, // Save sort order
                    is_brainstorm: i.is_brainstorm,
                    place_id: i.place_id,
                    place_data: i.place_data
                })));

            if (insertError) {
                console.error("Error inserting items:", insertError);
                alert("Failed to create some items: " + insertError.message);
                return;
            }
        }

        // Refresh Data
        if (planData && planData[0]) {
            const updated = planData[0];
            setPlans(plans.map(p => p.id === id ? updated : p));
            setSelectedPlan(updated); // This triggers fetchItems which will get authoritative state from DB
            alert("Itinerary saved successfully!");
        }
    };

    const placesServiceRef = React.useRef(null);
    const [placesService, setPlacesService] = useState(null);

    useEffect(() => {
        if (isLoaded && placesServiceRef.current && !placesService) {
            setPlacesService(new google.maps.places.PlacesService(placesServiceRef.current));
        }
    }, [isLoaded, placesServiceRef.current]);

    // ... existing code ...

    const addItem = async (isBrainstorm = true) => {
        if (!selectedPlan || !newItem.activity) return;

        let placeData = null;

        if (newItem.place_id && placesService) {
            try {
                const details = await new Promise((resolve, reject) => {
                    placesService.getDetails({
                        placeId: newItem.place_id,
                        fields: ['photos', 'rating', 'user_ratings_total', 'url', 'icon']
                    }, (place, status) => {
                        if (status === google.maps.places.PlacesServiceStatus.OK) {
                            resolve(place);
                        } else {
                            resolve(null); // Fail gracefully
                        }
                    });
                });

                if (details) {
                    placeData = {
                        rating: details.rating,
                        user_ratings_total: details.user_ratings_total,
                        icon: details.icon,
                        url: details.url,
                        photos: details.photos ? details.photos.map(p => ({
                            url: p.getUrl({ maxWidth: 200, maxHeight: 200 }),
                            attribution: p.html_attributions
                        })).slice(0, 1) : [] // Just take first photo for now
                    };
                }
            } catch (err) {
                console.error("Error fetching place details:", err);
            }
        }

        const newItemObj = {
            id: `temp-${Date.now()}`, // Temporary ID
            // plan_id: selectedPlan.id, // Not strictly needed for local, but good for consistency
            ...newItem,
            cost: newItem.cost === '' ? null : newItem.cost,
            duration: newItem.duration === '' ? null : newItem.duration,
            is_brainstorm: isBrainstorm,
            place_id: newItem.place_id,
            place_data: placeData
        };
        delete newItemObj.lat;
        delete newItemObj.lng;

        // Add to local state
        setItems([...items, newItemObj]);
        setNewItem({ activity: '', location: '', link: '', cost: '', duration: '', lat: null, lng: null, place_id: null });
        setIsDirty(true);
    };

    // ... existing functions ...

    return (
        <div style={{ height: '100%', display: 'flex', gap: '2rem', padding: '1rem', overflow: 'hidden' }}>
            {/* Hidden div for Places Service */}
            <div ref={placesServiceRef} style={{ display: 'none' }}></div>

            {/* Sidebar: Plans List */}
            {/* ... existing sidebar ... */}
            <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '1rem', borderRight: '1px solid var(--border-dim)', paddingRight: '1rem' }}>
                {/* ... same sidebar content ... */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 className="box-header" style={{ margin: 0, fontSize: '1.5rem' }}><GiTreasureMap /> Itineraries</h2>
                    <button
                        onClick={() => setIsCreating(true)}
                        style={{ background: 'var(--accent-gold)', border: 'none', color: 'var(--bg-main)', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        +
                    </button>
                </div>

                {isCreating && (
                    <div style={{ padding: '1rem', background: 'var(--bg-panel)', border: '1px solid var(--border-gold)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <input
                            placeholder="Title (e.g. Day in SF)"
                            value={newPlan.title}
                            onChange={e => setNewPlan({ ...newPlan, title: e.target.value })}
                            style={{ padding: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                        />

                        {isLoaded ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <PlacesSearch
                                    onSelect={(place) => setNewPlan({ ...newPlan, location: place.address })}
                                    placeholder="Location (City/Area)"
                                />
                                <input
                                    type="date"
                                    value={newPlan.planned_date || ''}
                                    onChange={e => setNewPlan({ ...newPlan, planned_date: e.target.value })}
                                    style={{ padding: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)', width: '100%' }}
                                />
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <input
                                    placeholder="Location"
                                    value={newPlan.location}
                                    onChange={e => setNewPlan({ ...newPlan, location: e.target.value })}
                                    style={{ padding: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                                />
                                <input
                                    type="date"
                                    value={newPlan.planned_date || ''}
                                    onChange={e => setNewPlan({ ...newPlan, planned_date: e.target.value })}
                                    style={{ padding: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)', width: '100%' }}
                                />
                            </div>
                        )}
                        <button onClick={createPlan} style={{ background: 'var(--accent-gold)', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--bg-main)', fontWeight: 'bold' }}>Create</button>
                        <button onClick={() => setIsCreating(false)} style={{ background: 'transparent', border: '1px solid var(--border-dim)', padding: '4px', cursor: 'pointer', color: 'var(--text-muted)' }}>Cancel</button>
                    </div>
                )}

                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {plans.map(plan => (
                        <div
                            key={plan.id}
                            onClick={() => {
                                if (isDirty) {
                                    if (window.confirm("You have unsaved changes. Discard them?")) {
                                        setSelectedPlan(plan);
                                    }
                                } else {
                                    setSelectedPlan(plan);
                                }
                            }}
                            style={{
                                padding: '1rem',
                                background: selectedPlan?.id === plan.id ? 'var(--accent-gold)' : 'var(--bg-panel)',
                                color: selectedPlan?.id === plan.id ? 'var(--bg-main)' : 'var(--text-main)',
                                border: '1px solid var(--border-dim)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                position: 'relative'
                            }}
                        >
                            <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontFamily: 'var(--font-display)' }}>{plan.title}</h3>
                            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{plan.location || 'Unknown Locale'}</div>
                            {plan.planned_date && <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{plan.planned_date}</div>}

                            <button
                                onClick={(e) => deletePlan(e, plan.id)}
                                style={{
                                    position: 'absolute',
                                    top: '5px',
                                    right: '5px',
                                    background: deleteConfirm === plan.id ? 'var(--bg-main)' : 'transparent',
                                    border: 'none',
                                    color: deleteConfirm === plan.id ? 'var(--accent-crimson)' : 'inherit',
                                    opacity: deleteConfirm === plan.id ? 1 : 0.5,
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    padding: '2px 4px',
                                    fontSize: '0.8rem',
                                    fontWeight: deleteConfirm === plan.id ? 'bold' : 'normal'
                                }}
                            >
                                {deleteConfirm === plan.id ? 'Confirm?' : <GiCancel />}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Area: Planner */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {editedPlan ? (
                    <>
                        {/* Header Area */}
                        <div style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-dim)', paddingBottom: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <input
                                    value={editedPlan.title}
                                    onChange={(e) => handlePlanChange('title', e.target.value)}
                                    style={{
                                        fontFamily: 'var(--font-display)',
                                        color: 'var(--text-gold)',
                                        background: 'transparent',
                                        border: 'none',
                                        fontSize: '2rem',
                                        width: '100%',
                                        marginBottom: '0.5rem'
                                    }}
                                />
                                {isDirty && (
                                    <button
                                        onClick={saveChanges}
                                        style={{
                                            background: 'var(--accent-gold)',
                                            color: 'var(--bg-main)',
                                            border: 'none',
                                            padding: '8px 16px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            whiteSpace: 'nowrap',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                        }}
                                    >
                                        Save Changes
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        const icsContent = generateICS(editedPlan, items);
                                        if (icsContent) {
                                            downloadICS(`${editedPlan.title || 'Itinerary'}.ics`, icsContent);
                                        } else {
                                            alert("No scheduled items to export.");
                                        }
                                    }}
                                    style={{
                                        background: 'transparent',
                                        color: 'var(--text-gold)',
                                        border: '1px solid var(--border-gold)',
                                        padding: '8px 16px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        whiteSpace: 'nowrap',
                                        marginLeft: '1rem'
                                    }}
                                    title="Export to Calendar (.ics)"
                                >
                                    Export .ics
                                </button>
                            </div>

                            <div style={{ color: 'var(--text-muted)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <GiPositionMarker />
                                    <input
                                        value={editedPlan.location || ''}
                                        onChange={(e) => handlePlanChange('location', e.target.value)}
                                        placeholder="Location"
                                        style={{ background: 'transparent', border: 'none', color: 'inherit', fontSize: 'inherit' }}
                                    />
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <GiSandsOfTime />
                                    <input
                                        type="date"
                                        value={editedPlan.planned_date || ''}
                                        onChange={(e) => handlePlanChange('planned_date', e.target.value)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'inherit',
                                            fontFamily: 'inherit',
                                            fontSize: 'inherit',
                                            cursor: 'pointer'
                                        }}
                                    />
                                </span>
                                <button
                                    onClick={(e) => deletePlan(null, editedPlan.id)}
                                    disabled={processingDelete}
                                    style={{
                                        marginLeft: 'auto',
                                        background: deleteConfirm === editedPlan.id ? 'var(--accent-crimson)' : 'rgba(255, 99, 71, 0.1)',
                                        border: '1px solid var(--accent-crimson)',
                                        color: deleteConfirm === editedPlan.id ? 'var(--bg-main)' : 'var(--accent-crimson)',
                                        padding: '4px 12px',
                                        borderRadius: '4px',
                                        cursor: processingDelete ? 'wait' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontSize: '0.8rem',
                                        transition: 'all 0.2s',
                                        fontWeight: deleteConfirm === editedPlan.id ? 'bold' : 'normal'
                                    }}
                                >
                                    <GiCancel /> {processingDelete ? 'Deleting...' : (deleteConfirm === editedPlan.id ? 'Click to Confirm Delete' : 'Delete Itinerary')}
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '2rem', flex: 1, overflow: 'hidden' }}>

                            {/* Brainstorming Board */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', borderRight: '1px dashed var(--border-dim)', paddingRight: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-gold)' }}>
                                    <GiFeather size={24} />
                                    <h3 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Brainstorming</h3>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', border: '1px solid var(--border-dim)' }}>
                                    <input
                                        placeholder="Add activity idea..."
                                        value={newItem.activity}
                                        onChange={e => setNewItem({ ...newItem, activity: e.target.value })}
                                        style={{ width: '100%', marginBottom: '0.5rem', padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                                    />
                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        {isLoaded ? (
                                            <div style={{ flex: 1 }}>
                                                <PlacesSearch
                                                    onSelect={(place) => setNewItem({ ...newItem, location: place.address, lat: place.lat, lng: place.lng, link: place.link, place_id: place.place_id })}
                                                    placeholder="Search Location..."
                                                />
                                            </div>
                                        ) : (
                                            <input
                                                placeholder="Location/Link"
                                                value={newItem.link} // Fallback to existing behavior
                                                onChange={e => setNewItem({ ...newItem, link: e.target.value })}
                                                style={{ flex: 1, padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                                            />
                                        )}
                                        <input
                                            placeholder="Cost ($)"
                                            value={newItem.cost}
                                            onChange={e => setNewItem({ ...newItem, cost: e.target.value })}
                                            style={{ width: '80px', padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-dim)', color: 'var(--text-main)' }}
                                        />
                                    </div>
                                    {newItem.link && <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', marginBottom: '0.5rem' }}>Linked: {newItem.location}</div>}
                                    <button onClick={() => addItem(true)} style={{ width: '100%', padding: '8px', background: 'rgba(207, 181, 59, 0.2)', border: '1px solid var(--accent-gold)', color: 'var(--text-gold)', cursor: 'pointer' }}>
                                        Add to Board
                                    </button>
                                </div>

                                <div style={{ overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', gridAutoRows: 'max-content' }}>
                                    {items.filter(i => i.is_brainstorm).map(item => (
                                        <div
                                            key={item.id}
                                            draggable
                                            onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
                                            style={{
                                                background: '#fff9c4',
                                                color: '#333',
                                                padding: '1rem',
                                                boxShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                                                transform: `rotate(${Math.random() * 4 - 2}deg)`,
                                                position: 'relative',
                                                cursor: 'grab',
                                                overflow: 'hidden'
                                            }}>

                                            {/* Place Image */}
                                            <PlaceImage
                                                photo={item.place_data?.photos?.[0]}
                                                style={{ height: '80px', marginBottom: '8px' }}
                                            />

                                            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{item.activity}</div>

                                            {item.place_data && item.place_data.rating && (
                                                <div style={{ fontSize: '0.8rem', color: '#f39c12', marginBottom: '4px' }}>
                                                    ★ {item.place_data.rating} <span style={{ color: '#777' }}>({item.place_data.user_ratings_total})</span>
                                                </div>
                                            )}

                                            {item.location && <div style={{ fontSize: '0.8rem', color: '#555', marginBottom: '4px' }}><GiPositionMarker /> {item.location}</div>}
                                            {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: '0.8rem', color: 'blue', marginBottom: '4px' }}>Map ↗</a>}
                                            {item.cost && <div style={{ fontSize: '0.8rem', color: '#555' }}><GiCoins /> {item.cost}</div>}
                                            <button
                                                onClick={() => deleteItem(item.id)}
                                                style={{ position: 'absolute', top: '2px', right: '2px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#888' }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Timeline / Itinerary */}
                            <div
                                style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const itemId = e.dataTransfer.getData('text/plain');
                                    if (itemId) moveItemToTimeline(itemId);
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-crimson)' }}>
                                    <GiHourglass size={24} />
                                    <h3 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>The Itinerary</h3>
                                </div>

                                <div style={{ flex: 1, borderLeft: '2px solid var(--border-dim)', paddingLeft: '2rem', position: 'relative', overflowY: 'auto' }}>

                                    {items.filter(i => !i.is_brainstorm).length === 0 && (
                                        <div style={{
                                            padding: '2rem',
                                            textAlign: 'center',
                                            color: 'var(--text-muted)',
                                            border: '2px dashed var(--border-dim)',
                                            borderRadius: '8px'
                                        }}>
                                            Drag brainstorm items here to schedule them
                                        </div>
                                    )}



                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext
                                            items={items.filter(i => !i.is_brainstorm).map(i => i.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {items.filter(i => !i.is_brainstorm).map((item, index, arr) => (
                                                <React.Fragment key={item.id}>
                                                    <SortableItem item={item}>
                                                        <div style={{ position: 'relative', touchAction: 'none' }}>
                                                            {/* Decor: Timeline Line */}
                                                            {index !== arr.length - 1 && (
                                                                <div style={{
                                                                    position: 'absolute',
                                                                    left: '26px', // Center of the timeline
                                                                    top: '50px',
                                                                    bottom: '-2rem', // Connect to next
                                                                    width: '2px',
                                                                    background: 'var(--border-dim)',
                                                                    zIndex: 0
                                                                }} />
                                                            )}

                                                            <div style={{
                                                                background: 'var(--bg-panel)',
                                                                padding: '1rem',
                                                                border: '1px solid var(--border-dim)',
                                                                display: 'flex',
                                                                gap: '1rem',
                                                                alignItems: 'flex-start',
                                                                borderRadius: '4px',
                                                                position: 'relative',
                                                                zIndex: 1
                                                            }}>

                                                                {/* Time & Drag Column */}
                                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '60px' }}>
                                                                    {/* Drag Handle */}
                                                                    <div style={{ cursor: 'grab', color: 'var(--text-muted)' }} {...item.dragHandleProps}>
                                                                        <GiRoughWound size={20} style={{ transform: 'rotate(90deg)' }} />
                                                                    </div>
                                                                    {/* Time */}
                                                                    <SmartTimeInput
                                                                        value={item.start_time ? item.start_time.substring(0, 5) : ''}
                                                                        onChange={(newTime) => updateItem(item.id, { start_time: newTime ? newTime + ":00" : null })}
                                                                    />
                                                                </div>

                                                                {/* Image */}
                                                                <PlaceImage
                                                                    photo={item.place_data?.photos?.[0]}
                                                                    style={{
                                                                        width: '80px',
                                                                        height: '80px',
                                                                        borderRadius: '4px',
                                                                        flexShrink: 0,
                                                                        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
                                                                    }}
                                                                />

                                                                {/* Main Content */}
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                                                                        <div>
                                                                            <h4 style={{
                                                                                fontSize: '1.2rem',
                                                                                fontFamily: 'var(--font-display)',
                                                                                margin: '0 0 4px 0',
                                                                                color: 'var(--text-main)',
                                                                                lineHeight: '1.2'
                                                                            }}>
                                                                                {item.activity}
                                                                            </h4>
                                                                            {item.location && (
                                                                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                    <GiPositionMarker />
                                                                                    {item.link ? (
                                                                                        <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>{item.location}</a>
                                                                                    ) : (
                                                                                        item.location
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Action Icons (Grouped & Smaller) */}
                                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                                            {editedPlan.planned_date && item.start_time && (
                                                                                <a
                                                                                    href={generateGoogleCalendarUrl(item, editedPlan.planned_date)}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    style={{ padding: '4px', opacity: 0.6, cursor: 'pointer', color: 'var(--text-main)' }}
                                                                                    title="Add to Google Calendar"
                                                                                >
                                                                                    📅
                                                                                </a>
                                                                            )}
                                                                            <button
                                                                                onClick={() => updateItem(item.id, { is_brainstorm: true })}
                                                                                title="Move back to brainstorm"
                                                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.5, padding: '4px', color: 'var(--text-main)' }}
                                                                            >
                                                                                <GiNotebook size={16} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => deleteItem(item.id)}
                                                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)', padding: '4px' }}
                                                                            >
                                                                                <GiCancel size={16} />
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    {/* Metadata Row */}
                                                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                                        {item.place_data && item.place_data.rating && (
                                                                            <span style={{ color: '#f39c12' }}>★ {item.place_data.rating}</span>
                                                                        )}
                                                                        {item.cost && (
                                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><GiCoins /> {item.cost}</span>
                                                                        )}
                                                                        {item.duration && (
                                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><GiHourglass /> {item.duration}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </SortableItem>

                                                    {/* Travel Time Connector */}
                                                    {travelTimes[item.id] && index !== arr.length - 1 && (
                                                        <div style={{
                                                            paddingLeft: '60px', // Align with content
                                                            margin: '0.5rem 0',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            color: 'var(--text-gold)',
                                                            fontSize: '0.85rem',
                                                            fontFamily: 'var(--font-mono)'
                                                        }}>
                                                            <div style={{ width: '2px', height: '20px', background: 'var(--border-gold)', margin: '0 8px' }}></div>
                                                            <span>🚗 {travelTimes[item.id]} drive</span>
                                                        </div>
                                                    )}
                                                    {/* Spacer if no travel time but not last */}
                                                    {!travelTimes[item.id] && index !== arr.length - 1 && <div style={{ height: '1rem' }}></div>}
                                                </React.Fragment>
                                            ))}
                                        </SortableContext>
                                    </DndContext>

                                    {/* Link Travel Times based on ORDER index */}
                                    {/* NOTE: travelTimes uses ID to map, so it might lag a bit behind drag until recalculate happens. 
                                        But re-render will map correctly. 
                                    */}
                                    {/* We can't easily intersperse travel time divs inside SortableContext efficiently without making them sortable too or complex.
                                        Alternative: put them inside the SortableItem bottom? 
                                    */}

                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        <GiTreasureMap size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                        <p style={{ fontSize: '1.2rem' }}>Select an itinerary or start a new daydream.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DayPlanner;
