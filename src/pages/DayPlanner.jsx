import React, { useState, useEffect } from 'react';
import { GiCompass, GiTreasureMap, GiNotebook, GiSandsOfTime, GiPositionMarker, GiFeather, GiHourglass, GiCoins, GiCancel, GiForkKnifeSpoon, GiOpenBook } from 'react-icons/gi';
import { useSearchParams } from 'react-router-dom';
import { useJsApiLoader } from '@react-google-maps/api';
import PlacesSearch from '../components/PlacesSearch';
import SmartTimeInput from '../components/SmartTimeInput';
import { Button, Card, ConfirmButton, EmptyState, Field, Tabs } from '../components/ui';
import MentionInput from '../components/MentionInput';
import TableBook from './TableBook';
import Commonplace from './Commonplace';
import SendToAtlas from '../components/SendToAtlas';
import DayCard from '../components/DayCard';
import { useTravelTimes } from '../hooks/useTravelTimes';
import { departAt, nextSlot } from '../utils/departAt';
import DurationPicker from '../components/DurationPicker';
import ActivityFace from '../components/ActivityFace';
import { compareItems, timeBetween, asMinutes, asTime, lengthOf } from '../utils/dayOrder';
import { supabase } from '../lib/supabase';
import { generateGoogleCalendarUrl, generateICS, downloadICS } from '../utils/calendarUtils';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import '../styles/DayPlanner.css';

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const libraries = ['places'];

/**
 * Sortable wrapper. The drag listeners deliberately do NOT go on this
 * container — it holds buttons and links, and dnd-kit's attributes turn a
 * container into role="button" with tabIndex=0. `children` is a function so
 * the row can put them on a real handle instead.
 */
const SortableItem = ({ item, children }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={isDragging ? 'sortable is-dragging' : 'sortable'}
        >
            {children({ ...attributes, ...listeners, ref: setActivatorNodeRef })}
        </div>
    );
};

/**
 * A place's photo, when there is one that still works.
 *
 * The Maps JS API hands out `PhotoService.GetPhoto` URLs, which are bound to
 * the session that asked for them and expire. Cached in `place_data` months
 * ago, every one of them now returns Google's own "image unavailable"
 * graphic — a little map with a red cross through it. Which loads perfectly,
 * so `onerror` never fires and the card cheerfully shows a broken picture.
 *
 * They are treated as no photo at all. The place's own name and address were
 * always the useful part, and an empty tile on every card is worse than the
 * width it costs — so when there is nothing to show, nothing is drawn.
 */
const EXPIRING = /PhotoService\.GetPhoto/;

const PlaceImage = ({ photo, className = '', fallback = null }) => {
    const [failed, setFailed] = React.useState(false);
    const [loaded, setLoaded] = React.useState(false);

    const url = photo?.url && !EXPIRING.test(photo.url) ? photo.url : null;

    React.useEffect(() => {
        if (!url) return undefined;
        let alive = true;
        const img = new Image();
        img.onload = () => { if (alive) setLoaded(true); };
        img.onerror = () => { if (alive) setFailed(true); };
        img.src = url;
        return () => { alive = false; };
    }, [url]);

    // No photo, or a URL that loaded a "no image" placeholder: show the
    // fallback rather than a gap. Most cards land here.
    if (!url || failed) return fallback;
    if (!loaded) return <div className={`place-image place-image--empty ${className}`} />;

    return (
        <div
            className={`place-image ${className}`}
            style={{ backgroundImage: `url(${url})` }}
        />
    );
};

const DayPlanner = () => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: googleMapsApiKey,
        libraries
    });

    // 'itineraries' | 'spots' | 'build'. A saved place outlives any particular
    // day, so the library sits beside the days rather than inside one; the
    // builder is what turns a place name into a day made of both.
    /* ?tab=table is how the old /tablebook address arrives, so a bookmark to
       the room that no longer exists still lands on the thing it was for. */
    const [params, setParams] = useSearchParams();
    const [view, setView] = useState(() => (
        ['itineraries', 'table', 'keeping'].includes(params.get('tab'))
            ? params.get('tab')
            : 'itineraries'
    ));

    const chooseView = (next) => {
        setView(next);
        // Keep the address honest, so the tab survives a reload and can be
        // linked to from anywhere else in the portal.
        setParams(next === 'itineraries' ? {} : { tab: next }, { replace: true });
    };
    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [items, setItems] = useState([]); // Items for selected plan
    const [deletedItemIds, setDeletedItemIds] = useState([]); // Track items to delete on save
    const [loading, setLoading] = useState(true);

    const [processingDelete, setProcessingDelete] = useState(false);

    // Form States
    const [isCreating, setIsCreating] = useState(false); // Creating new plan
    const [newPlan, setNewPlan] = useState({ title: '', location: '', notes: '' });

    const [newItem, setNewItem] = useState({ activity: '', location: '', link: '', cost: '', duration: '', lat: null, lng: null });
    /* Where an @-mentioned place should be looked for. The plan's own
       location, geocoded, so the search is *biased* towards the city rather
       than having the city's name glued onto the query — which is how
       "@masque" once came back as a list of mosques. */
    const [planNear, setPlanNear] = useState(null);
    const [saving, setSaving] = useState(false);
    const savingRef = React.useRef(false);
    const [saveError, setSaveError] = useState(null);
    /* The send-to-someone sheet. */
    const [sharing, setSharing] = useState(false);
    const [savedAt, setSavedAt] = useState(null);

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
            alert('You must be logged in to create a plan.');
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
    /* See utils/dayOrder: the old comparator returned 1 for both cmp(a, b)
       and cmp(b, a) when neither card had a time, which is a comparator
       saying each of two things comes after the other. Sort is allowed to do
       anything with that, and did. */
    const sortItems = (itemsList) => [...itemsList].sort(compareItems);

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

        if (!over || active.id === over.id) return;

        // State updaters must stay pure — StrictMode double-invokes them, so
        // the dirty flag is set here rather than inside the updater.
        setItems((current) => {
            const oldIndex = current.findIndex(i => i.id === active.id);
            const newIndex = current.findIndex(i => i.id === over.id);

            // 1. Move the item in the array
            const newItems = arrayMove(current, oldIndex, newIndex);

            // 2. Put it where it was dropped.
            //
            // The old rule was "start when the previous one ends", and the
            // list is then re-sorted by time — so dropping something between
            // a 9am thing that runs two hours and a 10am thing gave it 11am,
            // which is *after* the card it was dropped in front of, and the
            // re-sort duly moved it there. The card did not go where it was
            // dropped, which is the whole contract of dragging one.
            const timelineItems = newItems.filter(i => !i.is_brainstorm);
            const at = timelineItems.findIndex(i => i.id === active.id);
            const activeItem = newItems[newIndex];
            const newStartTime = timeBetween(
                at > 0 ? timelineItems[at - 1] : null,
                at >= 0 && at < timelineItems.length - 1 ? timelineItems[at + 1] : null
            );

            // Update the moved item's time
            newItems[newIndex] = { ...activeItem, start_time: newStartTime };

            // CRITICAL: Re-sort based on the new times to ensure chronology
            // This prevents "18:00 before 15:00" scenarios if the drop target wasn't perfect
            return sortItems(newItems);
        });

        setIsDirty(true);
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

    const deletePlan = async (id) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setProcessingDelete(true);

        const { error: itemsError } = await supabase.from('plan_items').delete().eq('plan_id', id);
        if (itemsError) {
            console.error('Error deleting items:', itemsError);
            alert('Error clearing itinerary items.');
            setProcessingDelete(false);
            return;
        }

        const { error } = await supabase.from('day_plans').delete().eq('id', id).eq('user_id', user.id);
        if (error) {
            console.error('Error deleting plan:', error);
            alert('Failed to delete plan: ' + error.message);
        } else {
            setPlans(plans.filter(p => p.id !== id));
            if (selectedPlan?.id === id) setSelectedPlan(null);
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

    /* Off the board and onto the day. It used to always land at 09:00, which
       on a day that already runs to six means dragging it the whole length of
       the board. The end of the day is where it almost always belongs. */
    const moveItemToTimeline = async (id) => {
        await updateItem(id, {
            is_brainstorm: false,
            start_time: nextSlot(items.filter((i) => !i.is_brainstorm && i.id !== id)),
        });
    };

    const handlePlanChange = (field, value) => {
        setEditedPlan(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const selectPlan = (plan) => {
        if (isDirty && !window.confirm('You have unsaved changes. Discard them?')) return;
        setSelectedPlan(plan);
    };

    const saveChanges = async () => {
        /* Two saves at once inserts the pending cards twice — which is the
           "some cards duplicate and show back up" of it. The button is
           disabled while this runs, and this refuses to start a second one
           whatever the button does. */
        if (!editedPlan || savingRef.current) return;
        savingRef.current = true;
        setSaving(true);
        try {
            await runSave();
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const runSave = async () => {
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
            console.error('Error saving plan details:', planError);
            setSaveError(`Could not save the itinerary: ${planError.message}`);
            return;
        }
        setSaveError(null);

        // 2. Process Deletions
        if (deletedItemIds.length > 0) {
            const { error: deleteError } = await supabase
                .from('plan_items')
                .delete()
                .in('id', deletedItemIds);

            if (deleteError) {
                console.error('Error deleting items:', deleteError);
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
                    place_data: i.place_data,
                    travel_note: i.travel_note ?? null,
                    icon: i.icon ?? null
                })));

            if (updateError) {
                console.error('Error updating items:', updateError);
                setSaveError(`Could not save the changes: ${updateError.message}`);
                return;
            }
        }

        // Inserts
        let inserted = [];
        if (newItems.length > 0) {
            const { data: madeRows, error: insertError } = await supabase
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
                    place_data: i.place_data,
                    travel_note: i.travel_note ?? null,
                    icon: i.icon ?? null
                })))
                .select();

            if (insertError) {
                console.error('Error inserting items:', insertError);
                setSaveError(`Could not add ${newItems.length === 1 ? 'that card' : 'some cards'}: ${insertError.message}`);
                return;
            }
            inserted = madeRows || [];
        }

        /* The cards that were just created now have real ids. Swapping them in
           here — rather than only after a refetch that used to be skipped
           whenever the plan row came back empty — is what stops the next save
           inserting the same cards a second time. */
        if (inserted.length) {
            setItems((current) => {
                const spare = [...inserted];
                return current.map((i) => (
                    typeof i.id === 'string' && i.id.startsWith('temp-')
                        ? (spare.shift() || i)
                        : i
                ));
            });
        }

        setIsDirty(false);
        setSavedAt(Date.now());

        // The plan row, whether or not the update handed one back.
        const updated = planData?.[0];
        if (updated) {
            setPlans(plans.map(p => p.id === id ? updated : p));
        }
        // Always re-read, so what is on screen is what is in the database.
        fetchItems(selectedPlan.id);
    };

    const placesServiceRef = React.useRef(null);
    const [placesService, setPlacesService] = useState(null);

    useEffect(() => {
        if (isLoaded && placesServiceRef.current && !placesService) {
            setPlacesService(new google.maps.places.PlacesService(placesServiceRef.current));
        }
    }, [isLoaded, placesServiceRef.current]);

    useEffect(() => {
        const where = selectedPlan?.location;
        if (!isLoaded || !where) return undefined;

        let alive = true;
        // `window.` explicitly: the rest of this file reaches for the bare
        // `google` global, which lint has never been able to see.
        new window.google.maps.Geocoder().geocode({ address: where }, (res, status) => {
            if (!alive) return;
            const at = status === 'OK' && res?.[0]?.geometry?.location;
            // Tagged with the location it was resolved for, so a stale answer
            // for the previous plan is ignored rather than used.
            setPlanNear(at
                ? { for: where, city: where, lat: at.lat(), lng: at.lng(), radiusKm: 30 }
                : { for: where, city: where });
        });
        return () => { alive = false; };
    }, [isLoaded, selectedPlan?.location]);

    /* Only the answer for the plan actually on screen. Until it arrives, the
       city's name alone, which is worse but is not wrong. */
    const near = planNear?.for === selectedPlan?.location
        ? planNear
        : (selectedPlan?.location ? { city: selectedPlan.location } : null);

    const addItem = async (isBrainstorm = true) => {
        if (!selectedPlan || !newItem.activity) return;

        let placeData = null;

        if (newItem.place_id && placesService) {
            try {
                const details = await new Promise((resolve) => {
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
                console.error('Error fetching place details:', err);
            }
        }

        const newItemObj = {
            id: `temp-${Date.now()}`, // Temporary ID
            ...newItem,
            cost: newItem.cost === '' ? null : newItem.cost,
            duration: newItem.duration === '' ? null : newItem.duration,
            is_brainstorm: isBrainstorm,
            /* Straight onto the day goes at the end of it — after whatever
               currently finishes last — rather than at nine in the morning or
               with no time at all. Every other position is one short drag
               from there. */
            start_time: isBrainstorm ? null : nextSlot(items.filter((i) => !i.is_brainstorm)),
            place_id: newItem.place_id,
            place_data: placeData
        };
        delete newItemObj.lat;
        delete newItemObj.lng;

        // Add to local state
        setItems(sortItems([...items, newItemObj]));
        setNewItem({ activity: '', location: '', link: '', cost: '', duration: '', lat: null, lng: null, place_id: null });
        setIsDirty(true);
    };

    const timelineItems = items.filter(i => !i.is_brainstorm);
    const brainstormItems = items.filter(i => i.is_brainstorm);

    /* Asked for once per pair of addresses, cached, and never blanked by a
       failed lookup. `legs` also says which gaps cannot be worked out and
       why, so the blank can be explained instead of just being blank. */
    const { times: travelTimes, legs: travelLegs } = useTravelTimes(timelineItems, isLoaded);
    const legFor = (id) => travelLegs.find((l) => l.id === id);

    /** Jump straight to a day the builder just made. */


    return (
        <div className={`daydream-page${view === 'itineraries' ? ' daydream-page--fixed' : ''}`}>
            <Tabs
                label="Daydream sections"
                active={view}
                onChange={chooseView}
                tabs={[
                    { id: 'itineraries', label: 'Itineraries', icon: <GiTreasureMap />, count: plans.length },
                    /* Booking a table is not a different activity from
                       planning the day the table is in. It was a room of its
                       own, which meant choosing which room to walk into
                       before you knew which one you wanted. */
                    { id: 'table', label: 'The Table Book', icon: <GiForkKnifeSpoon /> },
                    /* Same argument as the Table Book: what you saved because
                       it looked worth doing and the day you might do it on are
                       the same thought, and they were two rooms apart. */
                    { id: 'keeping', label: 'The Commonplace', icon: <GiOpenBook /> },
                ]}
            />

            {view === 'keeping' ? (
                <Commonplace embedded />
            ) : view === 'table' ? (
                <TableBook embedded />
            ) : (
        <div className="daydream">
            {/* Hidden node the Google PlacesService attaches to */}
            <div ref={placesServiceRef} className="daydream__places-anchor" />

            {editedPlan && (
                <DayCard
                    open={sharing}
                    onClose={() => setSharing(false)}
                    title={editedPlan.title}
                    date={editedPlan.planned_date}
                    items={items}
                    travel={travelTimes}
                />
            )}

            {/* Sidebar: Plans List */}
            <aside className="daydream__sidebar">
                <div className="daydream__sidebar-head">
                    <h2 className="section-title daydream__heading">
                        <GiTreasureMap /> Itineraries
                    </h2>
                    <Button icon label="Create itinerary" onClick={() => setIsCreating(true)}>+</Button>
                </div>

                {isCreating && (
                    <Card variant="flat" className="daydream__create">
                        <Field
                            label="Title"
                            placeholder="Title (e.g. Day in SF)"
                            value={newPlan.title}
                            onChange={e => setNewPlan({ ...newPlan, title: e.target.value })}
                        />

                        {isLoaded ? (
                            <Field label="Location">
                                <PlacesSearch
                                    onSelect={(place) => setNewPlan({ ...newPlan, location: place.address })}
                                    placeholder="Location (City/Area)"
                                />
                            </Field>
                        ) : (
                            <Field
                                label="Location"
                                placeholder="Location"
                                value={newPlan.location}
                                onChange={e => setNewPlan({ ...newPlan, location: e.target.value })}
                            />
                        )}

                        <Field
                            label="Date"
                            type="date"
                            value={newPlan.planned_date || ''}
                            onChange={e => setNewPlan({ ...newPlan, planned_date: e.target.value })}
                        />

                        <div className="row">
                            <Button variant="primary" onClick={createPlan}>Create</Button>
                            <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
                        </div>
                    </Card>
                )}

                <ul className="daydream__list">
                    {plans.map(plan => (
                        <li key={plan.id}>
                            <Card
                                variant="flat"
                                className={`plan-card${selectedPlan?.id === plan.id ? ' is-selected' : ''}`}
                            >
                                <h3 className="plan-card__title">
                                    <button
                                        type="button"
                                        className="plan-card__open"
                                        onClick={() => selectPlan(plan)}
                                    >
                                        {plan.title}
                                    </button>
                                </h3>
                                <p className="plan-card__meta">{plan.location || 'Unknown Locale'}</p>
                                <p className="plan-card__meta plan-card__date">{plan.planned_date || ''}</p>

                                <ConfirmButton
                                    className="plan-card__delete"
                                    icon={<GiCancel />}
                                    label={`Delete itinerary ${plan.title}`}
                                    confirmLabel="Confirm?"
                                    onConfirm={() => deletePlan(plan.id)}
                                />
                            </Card>
                        </li>
                    ))}
                    {!loading && plans.length === 0 && (
                        <li>
                            <p className="muted daydream__list-empty">No daydreams yet.</p>
                        </li>
                    )}
                </ul>
            </aside>

            {/* Main Area: Planner */}
            <section className="daydream__detail">
                {editedPlan ? (
                    <>
                        {/* Header Area */}
                        <header className="daydream__head">
                            <div className="daydream__head-row">
                                <input
                                    className="daydream__title-input"
                                    aria-label="Itinerary title"
                                    value={editedPlan.title}
                                    onChange={(e) => handlePlanChange('title', e.target.value)}
                                />
                                <div className="row daydream__head-actions">
                                    {isDirty && (
                                        <Button variant="primary" onClick={saveChanges} disabled={saving}>
                                            {saving ? 'Saving…' : 'Save Changes'}
                                        </Button>
                                    )}
                                    {/* Said here rather than in an alert box,
                                        which interrupts and then tells you
                                        nothing you can act on. */}
                                    {!isDirty && savedAt && !saveError && (
                                        <span className="daydream__saved">Saved</span>
                                    )}
                                    {/* A day worked out here is the same thing
                                        as a day of a trip, one scale down. It
                                        knows which day of the trip it is,
                                        because the itinerary has a date. */}
                                    {/* One page to send to whoever is coming.
                                        The editor is a working surface; this
                                        is the document. */}
                                    <Button onClick={() => setSharing(true)}>
                                        📮 Share sheet
                                    </Button>
                                    <SendToAtlas
                                        plan={editedPlan}
                                        items={items}
                                        onSent={() => setSelectedPlan((p) => (
                                            p ? { ...p, atlas_sent_at: new Date().toISOString() } : p
                                        ))}
                                    />
                                    <Button
                                        onClick={() => {
                                            const icsContent = generateICS(editedPlan, items);
                                            if (icsContent) {
                                                downloadICS(`${editedPlan.title || 'Itinerary'}.ics`, icsContent);
                                            } else {
                                                alert('No scheduled items to export.');
                                            }
                                        }}
                                        title="Export to Calendar (.ics)"
                                    >
                                        Export .ics
                                    </Button>
                                </div>
                            </div>

                            {saveError && (
                                <p className="daydream__save-error" role="status">{saveError}</p>
                            )}

                            <div className="daydream__meta">
                                <span className="daydream__meta-item">
                                    <GiPositionMarker />
                                    <input
                                        className="daydream__meta-input"
                                        value={editedPlan.location || ''}
                                        onChange={(e) => handlePlanChange('location', e.target.value)}
                                        placeholder="Location"
                                        aria-label="Itinerary location"
                                    />
                                </span>
                                <span className="daydream__meta-item">
                                    <GiSandsOfTime />
                                    <input
                                        className="daydream__meta-input"
                                        type="date"
                                        value={editedPlan.planned_date || ''}
                                        onChange={(e) => handlePlanChange('planned_date', e.target.value)}
                                        aria-label="Planned date"
                                    />
                                </span>
                                <ConfirmButton
                                    className="daydream__delete"
                                    label="Delete Itinerary"
                                    confirmLabel="Click to Confirm Delete"
                                    disabled={processingDelete}
                                    onConfirm={() => deletePlan(editedPlan.id)}
                                >
                                    <GiCancel /> {processingDelete ? 'Deleting...' : 'Delete Itinerary'}
                                </ConfirmButton>
                            </div>
                        </header>

                        <div className="daydream__boards">

                            {/* Brainstorming Board */}
                            <div className="board board--ideas">
                                <h3 className="board__title">
                                    <GiFeather size={24} /> Brainstorming
                                </h3>

                                <Card variant="flat" className="idea-form">
                                    {/* Type "@masque" and the real place
                                        arrives with its address and its map
                                        link, the same as in the Atlas — so
                                        describing the day is also how the
                                        places get pulled in. */}
                                    <Field label="Activity">
                                        <MentionInput
                                            placeholder="Something to do — type @ for a place"
                                            aria-label="Activity"
                                            value={newItem.activity}
                                            near={near}
                                            onChange={(activity) => setNewItem({ ...newItem, activity })}
                                            onPick={(place, activity) => setNewItem({
                                                ...newItem,
                                                activity,
                                                location: place.address || newItem.location,
                                                link: place.maps_url || newItem.link,
                                                place_id: place.place_id || newItem.place_id,
                                                lat: place.lat ?? newItem.lat,
                                                lng: place.lng ?? newItem.lng,
                                            })}
                                        />
                                    </Field>

                                    {/* The Location box below is a search
                                        widget, not a display of what is set —
                                        so a place pulled in by @ would land in
                                        the item with nothing on screen saying
                                        so. This is that. */}
                                    {(newItem.location || newItem.link) && (
                                        <p className="idea-form__pulled">
                                            <GiPositionMarker aria-hidden="true" />
                                            <span>{newItem.location || newItem.link}</span>
                                            {newItem.link && (
                                                <a href={newItem.link} target="_blank" rel="noopener noreferrer">map</a>
                                            )}
                                            <button
                                                type="button"
                                                aria-label="Forget this place"
                                                onClick={() => setNewItem({
                                                    ...newItem,
                                                    location: '', link: '', place_id: null, lat: null, lng: null,
                                                })}
                                            >
                                                ×
                                            </button>
                                        </p>
                                    )}

                                    <div className="idea-form__row">
                                        {isLoaded ? (
                                            <Field label="Location">
                                                <PlacesSearch
                                                    onSelect={(place) => setNewItem({ ...newItem, location: place.address, lat: place.lat, lng: place.lng, link: place.link, place_id: place.place_id })}
                                                    placeholder="Search Location..."
                                                />
                                            </Field>
                                        ) : (
                                            <Field
                                                label="Location/Link"
                                                placeholder="Location/Link"
                                                value={newItem.link} // Fallback to existing behavior
                                                onChange={e => setNewItem({ ...newItem, link: e.target.value })}
                                            />
                                        )}
                                        <Field
                                            label="Cost ($)"
                                            className="idea-form__cost"
                                            placeholder="Cost ($)"
                                            value={newItem.cost}
                                            onChange={e => setNewItem({ ...newItem, cost: e.target.value })}
                                        />
                                    </div>
                                    {newItem.link && <p className="idea-form__linked">Linked: {newItem.location}</p>}
                                    {/* Two doors, and the default is the one
                                        she uses: most things typed in here are
                                        things she is doing, not things she is
                                        considering. Straight onto the day, at
                                        the end of it. */}
                                    <div className="idea-form__actions">
                                        <Button variant="primary" block onClick={() => addItem(false)}>
                                            Add to the day
                                        </Button>
                                        <Button variant="ghost" block onClick={() => addItem(true)}>
                                            Just an idea
                                        </Button>
                                    </div>
                                </Card>

                                <ul className="idea-grid">
                                    {brainstormItems.map(item => (
                                        <li
                                            key={item.id}
                                            className="idea"
                                            draggable
                                            onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
                                        >
                                            <PlaceImage
                                                photo={item.place_data?.photos?.[0]}
                                                className="idea__photo"
                                                fallback={
                                                    <ActivityFace
                                                        item={item}
                                                        className="idea__face"
                                                        onChange={(icon) => updateItem(item.id, { icon })}
                                                    />
                                                }
                                            />

                                            <p className="idea__title">{item.activity}</p>

                                            {item.place_data && item.place_data.rating && (
                                                <p className="idea__rating">
                                                    ★ {item.place_data.rating} <span>({item.place_data.user_ratings_total})</span>
                                                </p>
                                            )}

                                            {item.location && <p className="idea__line"><GiPositionMarker /> {item.location}</p>}
                                            {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="idea__link">Map ↗</a>}
                                            {item.cost && <p className="idea__line"><GiCoins /> {item.cost}</p>}

                                            <ConfirmButton
                                                className="idea__delete"
                                                icon="×"
                                                label={`Delete ${item.activity || 'idea'}`}
                                                confirmLabel="Confirm?"
                                                onConfirm={() => deleteItem(item.id)}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Timeline / Itinerary */}
                            <div
                                className="board board--timeline"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const itemId = e.dataTransfer.getData('text/plain');
                                    if (itemId) moveItemToTimeline(itemId);
                                }}
                            >
                                <h3 className="board__title board__title--crimson">
                                    <GiHourglass size={24} /> The Itinerary
                                </h3>

                                <div className="timeline">
                                    {timelineItems.length === 0 && (
                                        <EmptyState
                                            icon={<GiHourglass />}
                                            message="Drag brainstorm items here to schedule them"
                                        />
                                    )}

                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext
                                            items={timelineItems.map(i => i.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {timelineItems.map((item, index, arr) => (
                                                <React.Fragment key={item.id}>
                                                    <SortableItem item={item}>
                                                        {(handleProps) => (
                                                            <div className="tl-row">
                                                                {/* Decor: Timeline Line */}
                                                                {index !== arr.length - 1 && <span className="tl-row__thread" />}

                                                                <Card variant="flat" className="tl-item">
                                                                    {/* The grip: a full-height strip on the
                                                                        leading edge, which is where every list
                                                                        that can be reordered puts one. It used
                                                                        to be a jagged glyph stacked on top of
                                                                        the time, where it read as a decoration
                                                                        of the clock rather than a thing to
                                                                        take hold of. */}
                                                                    <button
                                                                        type="button"
                                                                        className="tl-item__grip"
                                                                        aria-label={`Reorder ${item.activity || 'this item'}`}
                                                                        {...handleProps}
                                                                    >
                                                                        <span className="tl-item__grip-dots" aria-hidden="true" />
                                                                    </button>

                                                                    <div className="tl-item__aside">
                                                                        <SmartTimeInput
                                                                            label={`Start time for ${item.activity || 'item'}`}
                                                                            value={item.start_time ? item.start_time.substring(0, 5) : ''}
                                                                            onChange={(newTime) => updateItem(item.id, { start_time: newTime ? newTime + ':00' : null })}
                                                                        />
                                                                    </div>

                                                                    {/* A photo when Google has one worth
                                                                        showing, and a kind of thing when it
                                                                        does not — which is most of the time. */}
                                                                    <PlaceImage
                                                                        photo={item.place_data?.photos?.[0]}
                                                                        className="tl-item__photo"
                                                                        fallback={
                                                                            <ActivityFace
                                                                                item={item}
                                                                                onChange={(icon) => updateItem(item.id, { icon })}
                                                                            />
                                                                        }
                                                                    />

                                                                    {/* Main Content */}
                                                                    <div className="tl-item__main">
                                                                        <div className="tl-item__head">
                                                                            <div>
                                                                                <h4 className="tl-item__title">{item.activity}</h4>
                                                                                {item.location && (
                                                                                    <p className="tl-item__location">
                                                                                        <GiPositionMarker />
                                                                                        {item.link ? (
                                                                                            <a href={item.link} target="_blank" rel="noopener noreferrer">{item.location}</a>
                                                                                        ) : (
                                                                                            item.location
                                                                                        )}
                                                                                    </p>
                                                                                )}
                                                                            </div>

                                                                            {/* Action Icons (Grouped & Smaller) */}
                                                                            <div className="tl-item__actions">
                                                                                {editedPlan.planned_date && item.start_time && (
                                                                                    <Button
                                                                                        as="a"
                                                                                        icon
                                                                                        size="sm"
                                                                                        href={generateGoogleCalendarUrl(item, editedPlan.planned_date)}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        label="Add to Google Calendar"
                                                                                    >
                                                                                        📅
                                                                                    </Button>
                                                                                )}
                                                                                <Button
                                                                                    icon
                                                                                    size="sm"
                                                                                    label="Move back to brainstorm"
                                                                                    onClick={() => updateItem(item.id, { is_brainstorm: true })}
                                                                                >
                                                                                    <GiNotebook size={16} />
                                                                                </Button>
                                                                                <ConfirmButton
                                                                                    icon={<GiCancel size={16} />}
                                                                                    label="Delete plan item"
                                                                                    confirmLabel="Confirm?"
                                                                                    onConfirm={() => deleteItem(item.id)}
                                                                                />
                                                                            </div>
                                                                        </div>

                                                                        {/* Metadata Row */}
                                                                        <div className="tl-item__meta">
                                                                            {item.place_data && item.place_data.rating && (
                                                                                <span className="tl-item__rating">★ {item.place_data.rating}</span>
                                                                            )}
                                                                            {item.cost && (
                                                                                <span><GiCoins /> {item.cost}</span>
                                                                            )}
                                                                            {/* How long it takes was shown but
                                                                                never editable here, so it could
                                                                                only be set on the way in — which
                                                                                meant it usually was not set at
                                                                                all. A dinner is two hours until
                                                                                she says otherwise. */}
                                                                            <DurationPicker
                                                                                value={item.duration}
                                                                                label={item.activity}
                                                                                onChange={(duration) => updateItem(item.id, { duration })}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </Card>
                                                            </div>
                                                        )}
                                                    </SortableItem>

                                                    {/* Travel Time Connector */}
                                                    {index !== arr.length - 1 && (
                                                        <p className="tl-travel">
                                                            <span className="tl-travel__tick" />
                                                            {item.travel_note ? (
                                                                /* Hers wins: she typed it because Google
                                                                   could not or should not answer — a walk,
                                                                   a ferry, a place with no address. */
                                                                <>
                                                                    <span>🚶 {item.travel_note}</span>
                                                                    <button
                                                                        type="button"
                                                                        className="tl-travel__clear"
                                                                        aria-label="Clear this travel time"
                                                                        onClick={() => updateItem(item.id, { travel_note: null })}
                                                                    >
                                                                        ×
                                                                    </button>
                                                                </>
                                                            ) : travelTimes[item.id] ? (
                                                                <span>🚗 {travelTimes[item.id]} drive</span>
                                                            ) : (
                                                                <input
                                                                    className="tl-travel__input"
                                                                    defaultValue=""
                                                                    aria-label={`How long from ${item.activity || 'here'} to the next stop`}
                                                                    placeholder={
                                                                        legFor(item.id)?.missing
                                                                            ? 'No address either side — how long?'
                                                                            : 'How long to the next one?'
                                                                    }
                                                                    onBlur={(e) => {
                                                                        const v = e.target.value.trim();
                                                                        if (v) updateItem(item.id, { travel_note: v });
                                                                    }}
                                                                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                                                />
                                                            )}
                                                            {/* The subtraction nobody does in their
                                                                head: the next thing starts at seven,
                                                                the drive is forty-five minutes, so
                                                                leave at quarter past six. Marked
                                                                when this card is still running then. */}
                                                            {(() => {
                                                                const leave = departAt(
                                                                    item,
                                                                    arr[index + 1],
                                                                    item.travel_note || travelTimes[item.id]
                                                                );
                                                                if (!leave) return null;
                                                                if (!leave.late) {
                                                                    return (
                                                                        <span className="tl-travel__leave">
                                                                            leave by {leave.time.substring(0, 5)}
                                                                        </span>
                                                                    );
                                                                }
                                                                /* The arrangement does not work: this
                                                                   stop runs past the moment you had to
                                                                   set off. Said as a number of minutes
                                                                   late, because "tight" is a feeling
                                                                   and "25 min late" is a decision. */
                                                                return (
                                                                    <span
                                                                        className="tl-travel__leave is-tight"
                                                                        title={`${item.activity || 'This'} runs to ${
                                                                            asTime(asMinutes(item.start_time) + lengthOf(item)).substring(0, 5)
                                                                        }, but you need to leave at ${leave.time.substring(0, 5)}`}
                                                                    >
                                                                        ⚠️ {leave.late} min late — leave by {leave.time.substring(0, 5)}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </p>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </SortableContext>
                                    </DndContext>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="daydream__blank">
                        <EmptyState
                            icon={<GiTreasureMap />}
                            message="Select an itinerary or start a new daydream."
                            actionLabel="Start a new daydream"
                            onAction={() => setIsCreating(true)}
                        />
                    </div>
                )}
            </section>
        </div>
            )}
        </div>
    );
};

export default DayPlanner;
