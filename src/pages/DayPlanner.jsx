import React, { useState, useEffect, useMemo } from 'react';
import { GiCompass, GiTreasureMap, GiNotebook, GiSandsOfTime, GiPositionMarker, GiFeather, GiHourglass, GiCoins, GiCancel, GiForkKnifeSpoon, GiOpenBook, GiWorld } from 'react-icons/gi';
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
import DateField from '../components/DateField';
import { onShelf, shelfCounts, hasBeen, isArchived } from '../utils/planShelf';
import { isLinked, syncRows, describeSync } from '../utils/planSync';
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
    /* What the last push to a linked trip day did. */
    const [synced, setSynced] = useState(null);
    /* The trip this day was sent to, if it was. Looked up rather than stored:
       the day knows its trip, and one query is cheaper than a column that can
       drift out of step with atlas_day_id. */
    const [linkedTrip, setLinkedTrip] = useState(null);
    /* True while a brainstorm card has a field focused, so the card does not
       start dragging out from under the cursor mid-selection. */
    const [editingIdea, setEditingIdea] = useState(false);
    /* Which shelf of the sidebar is showing. Upcoming by default, because a
       list that also holds every Saturday since March is not a list of what
       is next. */
    const [shelf, setShelf] = useState('upcoming');
    const [shelving, setShelving] = useState(false);
    const [savedAt, setSavedAt] = useState(null);

    // Local state for editing to avoid auto-save jitter
    const [editedPlan, setEditedPlan] = useState(null);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    /* ?plan=<id> opens that itinerary. It is the other half of the Atlas
       lock: a stop that came from here links back, and this is what makes the
       link land somewhere useful rather than on the list. */
    useEffect(() => {
        const wanted = params.get('plan');
        if (!wanted || !plans.length) return;
        if (selectedPlan?.id === wanted) return;
        const found = plans.find((p) => String(p.id) === wanted);
        if (found) {
            setSelectedPlan(found);
            setView('itineraries');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plans, params]);

    useEffect(() => {
        if (selectedPlan) {
            setEditedPlan({ ...selectedPlan });
            setIsDirty(false);
            setSaveError(null);
            fetchItems(selectedPlan.id);
        } else {
            setItems([]);
            setEditedPlan(null);
            setIsDirty(false);
            setSaveError(null);
        }
    }, [selectedPlan]);

    /**
     * Save on its own, shortly after she stops.
     *
     * Half the editor already saved at once — deleting a card, archiving an
     * itinerary — and half waited for a button, so whether a change had stuck
     * depended on which change it was. That is not something anyone should
     * have to hold in their head while dragging cards about.
     *
     * The timer restarts on every change, so typing a title is one save at
     * the end rather than one per letter, and `saveChanges` refuses to start
     * a second run while one is going.
     */
    useEffect(() => {
        if (!isDirty || !editedPlan || saving) return undefined;
        const timer = setTimeout(() => { saveChanges(); }, 900);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDirty, items, editedPlan, saving]);


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

    /**
     * Delete a card, now.
     *
     * This used to remove it from the screen and add its id to a list that
     * the Save button would act on later. Two things went wrong with that,
     * and both of them read as "deleting does not stick".
     *
     * The list was built from a stale closure — `[...deletedItemIds, id]`
     * reads the array as it was at the last render, so deleting two cards
     * before React caught up dropped the first id on the floor. It vanished
     * from the screen, was never deleted, and reappeared on the next load.
     *
     * And the delete only happened if she pressed Save. Nobody presses Save
     * after deleting something; deleting *is* the decision. Leaving without
     * saving put it back.
     *
     * So it goes now, and if the database refuses, the card comes back and
     * says so, rather than staying gone on screen and present in the table.
     */
    const deleteItem = async (id) => {
        const pending = typeof id === 'string' && id.startsWith('temp-');
        // Off the screen at once: a delete that waits for the network reads
        // as a click that did nothing.
        setItems((list) => list.filter((i) => i.id !== id));

        // Never saved, so there is nothing to delete.
        if (pending) { setIsDirty(true); return; }

        const { error } = await supabase.from('plan_items').delete().eq('id', id);
        if (error) {
            console.error('Error deleting item:', error);
            setSaveError('That would not delete — it is still there. Try again.');
            if (selectedPlan) fetchItems(selectedPlan.id);
            return;
        }

        /* A delete is a change to the day, and a linked day has a copy of
           itself in a trip. Without this the card went from the itinerary and
           stayed in the Atlas for ever: deleting is the one edit that did not
           mark the plan dirty, so autosave never ran and the sync never
           followed. */
        setIsDirty(true);
    };

    /**
     * Put an itinerary away, or take it back out.
     *
     * Not deleting: a day that happened is the best record there is of what a
     * place was like and what it cost, and it is exactly what she opens when
     * planning the next one.
     */
    const archivePlan = async (id, archived = true) => {
        const at = archived ? new Date().toISOString() : null;
        setPlans((list) => list.map((p) => (p.id === id ? { ...p, archived_at: at } : p)));
        if (selectedPlan?.id === id && archived) setSelectedPlan(null);

        const { error } = await supabase.from('day_plans').update({ archived_at: at }).eq('id', id);
        if (error) {
            console.error('Error archiving plan:', error);
            fetchPlans();
        }
    };

    /** Everything whose day has been, in one go. */
    const archivePast = async () => {
        const gone = plans.filter((p) => !isArchived(p) && hasBeen(p));
        if (!gone.length || shelving) return;
        setShelving(true);

        const at = new Date().toISOString();
        const ids = gone.map((p) => p.id);
        setPlans((list) => list.map((p) => (ids.includes(p.id) ? { ...p, archived_at: at } : p)));
        if (selectedPlan && ids.includes(selectedPlan.id)) setSelectedPlan(null);

        const { error } = await supabase.from('day_plans').update({ archived_at: at }).in('id', ids);
        if (error) {
            console.error('Error archiving past plans:', error);
            fetchPlans();
        }
        setShelving(false);
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

    /* Functional, because `items` in this closure is the array as of the last
       render. Changing a time and then a duration before React caught up used
       to compute the second change from the pre-first-change list and throw
       the first one away. */
    const updateItem = async (id, updates) => {
        setItems((list) => {
            const next = list.map((i) => (i.id === id ? { ...i, ...updates } : i));
            // A changed time changes where the card belongs.
            return updates.start_time !== undefined ? sortItems(next) : next;
        });
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

    /* No "you have unsaved changes, discard them?" — the answer is always no,
       so it is not a question, it is an obstacle. Anything outstanding is
       written on the way out. */
    const selectPlan = async (plan) => {
        if (isDirty && editedPlan) await saveChanges();
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

    useEffect(() => {
        const dayId = editedPlan?.atlas_day_id;
        if (!dayId) { setLinkedTrip(null); return undefined; }

        let alive = true;
        (async () => {
            const { data } = await supabase
                .from('atlas_days')
                .select('id, date, trip_id, atlas_trips(destination)')
                .eq('id', dayId)
                .maybeSingle();
            if (!alive) return;
            setLinkedTrip(data
                ? { tripId: data.trip_id, name: data.atlas_trips?.destination || 'the trip', date: data.date }
                : null);
        })();
        return () => { alive = false; };
    }, [editedPlan?.atlas_day_id]);

    /**
     * Push a linked itinerary onto its trip day.
     *
     * Delete what this plan put there last time, insert what it says now.
     * Anything she made in the Atlas itself has no `from_plan_id` and is left
     * exactly where it is.
     *
     * Best-effort: a trip day that could not be updated is worth saying, and
     * is never a reason to fail the save of the itinerary itself.
     */
    const syncToTrip = async (plan, planItems, userId) => {
        if (!isLinked(plan)) return;

        try {
            await supabase.from('atlas_day_items')
                .delete()
                .eq('from_plan_id', plan.id)
                .eq('day_id', plan.atlas_day_id);

            const rows = syncRows(plan, planItems, userId);
            if (rows.length) {
                const { error } = await supabase.from('atlas_day_items').insert(rows);
                if (error) throw error;
            }
            setSynced(describeSync(rows));
        } catch (err) {
            /* This used to say so in the same quiet line a success uses, which
               is how a sync that failed *every single time* — the column was
               a bigint and the id is a uuid — went unnoticed for a day. A
               thing that is not working says so where errors are said. */
            console.error('Error keeping the trip day in step:', err);
            setSynced(null);
            setSaveError(`The itinerary is saved, but the trip's copy of this day was not updated: ${err.message}`);
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

        /* Deletions used to be processed here, from a list the delete
           button appended to. They happen at the moment she deletes now —
           see deleteItem. Nobody presses Save after deleting something. */

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
                    icon: i.icon ?? null,
                    cost_shared: i.cost_shared ?? null
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
                    icon: i.icon ?? null,
                    cost_shared: i.cost_shared ?? null
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
            setPlans((list) => list.map((p) => (p.id === id ? updated : p)));
        }

        /* If this day already went to a trip, the trip's copy of it goes back
           in step now — rather than being left behind until she sends it
           again and gets a second copy of everything.

           Read straight out of the fresh rows: the temp ids have just been
           swapped for real ones, and the ones already saved are current. */
        const { data: fresh } = await supabase
            .from('plan_items').select('*').eq('plan_id', selectedPlan.id);
        await syncToTrip(updated || editedPlan, fresh || [], user.id);

        /* Only push the server's rows back into state when the *set* of rows
           changed — which means an insert happened and a temp id needs
           swapping for a real one.

           It used to do this after every save unconditionally, and autosave
           runs 900ms after every keystroke. So typing a title replaced every
           item object on the board with a fresh one from the database, which
           re-rendered every card, remounted every uncontrolled input, and
           left the timeline's scroll container lurching under her hands. That
           is the freezing and sticking.

           When only fields changed, local state is already right: she typed
           it, and it is what was just written. */
        const idsOf = (list) => (list || []).map((i) => i.id).sort().join(',');
        if (!fresh) fetchItems(selectedPlan.id);
        else if (idsOf(fresh) !== idsOf(items)) setItems(sortItems(fresh));
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
        setItems((list) => sortItems([...list, newItemObj]));
        setNewItem({ activity: '', location: '', link: '', cost: '', duration: '', lat: null, lng: null, place_id: null });
        setIsDirty(true);
    };

    /* One shelf at a time, so the sidebar is a list of what is next rather
       than an archive that happens to have the next thing in it. */
    const counts = useMemo(() => shelfCounts(plans), [plans]);
    const shelved = useMemo(() => onShelf(plans, shelf), [plans, shelf]);

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

                <div className="daydream__shelves" role="group" aria-label="Which itineraries">
                    {[
                        ['upcoming', 'Coming up'],
                        ['past', 'Been'],
                        ['archived', 'Archive'],
                        ['all', 'All'],
                    ].map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            className={`daydream__shelf${shelf === id ? ' is-on' : ''}`}
                            aria-pressed={shelf === id}
                            onClick={() => setShelf(id)}
                        >
                            <span>{label}</span>
                            {counts[id] > 0 && <span>{counts[id]}</span>}
                        </button>
                    ))}
                </div>

                {/* Offered only where it makes sense, and only when there is
                    something to do: on the Been shelf, looking at the days
                    that have been. */}
                {shelf === 'past' && counts.past > 0 && (
                    <Button
                        block
                        className="daydream__shelve-all"
                        onClick={archivePast}
                        disabled={shelving}
                    >
                        {shelving ? 'Filing…' : `Archive all ${counts.past} that have been`}
                    </Button>
                )}

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

                        <Field label="Date">
                            <DateField
                                value={newPlan.planned_date}
                                onCommit={(v) => setNewPlan({ ...newPlan, planned_date: v })}
                                aria-label="Date"
                            />
                        </Field>

                        <div className="row">
                            <Button variant="primary" onClick={createPlan}>Create</Button>
                            <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
                        </div>
                    </Card>
                )}

                <ul className="daydream__list">
                    {shelved.length === 0 && (
                        <li className="daydream__list-empty">
                            {shelf === 'archived'
                                ? 'Nothing filed away yet.'
                                : shelf === 'past'
                                    ? 'Nothing has been and gone.'
                                    : 'Nothing coming up. Make one with +.'}
                        </li>
                    )}
                    {shelved.map(plan => (
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

                                {/* Not a confirm: putting something away is
                                    reversible, and asking twice about a
                                    reversible thing is how people stop
                                    tidying. */}
                                <Button
                                    icon
                                    size="sm"
                                    className="plan-card__shelve"
                                    label={isArchived(plan)
                                        ? `Put ${plan.title} back on the board`
                                        : `Archive ${plan.title}`}
                                    onClick={() => archivePlan(plan.id, !isArchived(plan))}
                                >
                                    {isArchived(plan) ? '↩' : '🗄'}
                                </Button>

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
                                {/* Small, and one row. Three full-size
                                    buttons under the title took as much of the
                                    page as the title, the location and the
                                    date put together, and none of them is used
                                    once a day. */}
                                <div className="daydream__head-actions">
                                    {/* One quiet line rather than a button she
                                        has to notice. Said here rather than in
                                        an alert box, which interrupts and then
                                        tells you nothing you can act on. */}
                                    <span
                                        className={`daydream__saved${isDirty || saving ? ' is-working' : ''}`}
                                        role="status"
                                    >
                                        {saving ? 'Saving…' : isDirty ? 'Unsaved' : savedAt ? 'Saved' : ''}
                                    </span>
                                    {/* One page to send to whoever is coming.
                                        The editor is a working surface; this
                                        is the document. */}
                                    {/* Straight to the trip day this itinerary
                                        was sent to. She planned the day in one
                                        room and wants to see it in the other,
                                        and that meant going to the Atlas and
                                        remembering which trip it was. */}
                                    {linkedTrip && (
                                        <Button
                                            as="a"
                                            size="sm"
                                            href={`/atlas?trip=${linkedTrip.tripId}`}
                                            title={`Open ${linkedTrip.name} in the Atlas`}
                                        >
                                            <GiWorld /> In {linkedTrip.name}
                                        </Button>
                                    )}
                                    <Button size="sm" onClick={() => setSharing(true)}>
                                        📮 Share sheet
                                    </Button>
                                    {/* A day worked out here is the same thing
                                        as a day of a trip, one scale down. */}
                                    <SendToAtlas
                                        plan={editedPlan}
                                        items={items}
                                        onSent={({ dayId }) => {
                                            const patch = {
                                                atlas_day_id: dayId,
                                                atlas_sent_at: new Date().toISOString(),
                                            };
                                            setSelectedPlan((p) => (p ? { ...p, ...patch } : p));
                                            setPlans((list) => list.map((p) => (
                                                p.id === editedPlan.id ? { ...p, ...patch } : p
                                            )));
                                        }}
                                    />
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            const icsContent = generateICS(editedPlan, items);
                                            if (icsContent) {
                                                downloadICS(`${editedPlan.title || 'Itinerary'}.ics`, icsContent);
                                            } else {
                                                setSaveError('Nothing on this day has a time yet, so there is nothing to put in a calendar.');
                                            }
                                        }}
                                        title="Export to Calendar (.ics)"
                                    >
                                        Export .ics
                                    </Button>
                                </div>
                            </div>

                            {/* What the last save did to the trip this day
                                belongs to, when it belongs to one. */}
                            {synced && !saveError && (
                                <p className="daydream__synced" role="status">
                                    {synced}
                                    <button type="button" onClick={() => setSynced(null)} aria-label="Dismiss">×</button>
                                </p>
                            )}

                            {saveError && (
                                <p className="daydream__save-error" role="status">
                                    {saveError}
                                    {/* Autosave does not keep retrying a save
                                        that failed — a loop against a database
                                        that is refusing is not help. This is
                                        the way back in. */}
                                    <button type="button" onClick={saveChanges} disabled={saving}>
                                        {saving ? 'Trying…' : 'Try again'}
                                    </button>
                                </p>
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
                                    <DateField
                                        className="daydream__meta-input"
                                        value={editedPlan.planned_date}
                                        onCommit={(v) => handlePlanChange('planned_date', v || null)}
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
                                            /* Draggable except when she is in a
                                               field: a native drag starts on
                                               mousedown and eats the text
                                               selection she was making. */
                                            draggable={!editingIdea}
                                            onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
                                            onFocusCapture={(e) => {
                                                if (e.target.matches('input, textarea')) setEditingIdea(true);
                                            }}
                                            onBlurCapture={() => setEditingIdea(false)}
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

                                            {/* Editable here too. A card lands on
                                                the board with whatever she called it
                                                in a hurry, and renaming it meant
                                                dragging it onto the day first. */}
                                            <input
                                                className="idea__title"
                                                key={`it-${item.id}`}
                                                aria-label={`Name of ${item.activity || 'this idea'}`}
                                                placeholder="What is it?"
                                                defaultValue={item.activity || ''}
                                                onBlur={(e) => {
                                                    const v = e.target.value.trim();
                                                    if (v !== (item.activity || '')) {
                                                        updateItem(item.id, { activity: v });
                                                    }
                                                }}
                                                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                            />

                                            {/* Why it is worth doing, which the title
                                                never has room for. */}
                                            <textarea
                                                className="idea__note"
                                                key={`in-${item.id}`}
                                                aria-label={`Notes on ${item.activity || 'this idea'}`}
                                                placeholder="Notes…"
                                                rows={1}
                                                defaultValue={item.notes || ''}
                                                onBlur={(e) => {
                                                    const v = e.target.value.trim();
                                                    if (v !== (item.notes || '')) {
                                                        updateItem(item.id, { notes: v || null });
                                                    }
                                                }}
                                            />

                                            {item.place_data && item.place_data.rating && (
                                                <p className="idea__rating">
                                                    ★ {item.place_data.rating} <span>({item.place_data.user_ratings_total})</span>
                                                </p>
                                            )}

                                            {item.location && <p className="idea__line"><GiPositionMarker /> {item.location}</p>}
                                            {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="idea__link">Map ↗</a>}
                                            {/* Everything the card on the day can
                                                do, the card on the board can do too:
                                                a maybe is still a thing with a price
                                                and a length. */}
                                            <div className="idea__fields">
                                                <span className="idea__field">
                                                    <GiCoins aria-hidden="true" />
                                                    <input
                                                        key={`ic-${item.id}`}
                                                        inputMode="decimal"
                                                        aria-label={`Cost of ${item.activity || 'this idea'}`}
                                                        placeholder="cost"
                                                        defaultValue={item.cost ?? ''}
                                                        onBlur={(e) => {
                                                            const v = e.target.value.trim();
                                                            if (v !== String(item.cost ?? '')) {
                                                                updateItem(item.id, { cost: v || null });
                                                            }
                                                        }}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                                    />
                                                    <button
                                                        type="button"
                                                        className={`tl-item__share${item.cost_shared === false ? '' : ' is-split'}`}
                                                        title={item.cost_shared === false
                                                            ? 'Each person pays this'
                                                            : 'Split across the party'}
                                                        onClick={() => updateItem(item.id, { cost_shared: item.cost_shared === false })}
                                                    >
                                                        {item.cost_shared === false ? 'each' : 'split'}
                                                    </button>
                                                </span>

                                                <DurationPicker
                                                    value={item.duration}
                                                    label={item.activity}
                                                    onChange={(duration) => updateItem(item.id, { duration })}
                                                />
                                            </div>

                                            {/* Giving a maybe a time is deciding to do
                                                it, so it moves to the day rather than
                                                sitting on the board with an hour on it
                                                that nothing reads. */}
                                            <button
                                                type="button"
                                                className="idea__schedule"
                                                onClick={() => moveItemToTimeline(item.id)}
                                            >
                                                Put it on the day →
                                            </button>

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

                                                                    {/* Time and the kind of thing it is, stacked in one
                                                                        narrow column. They were three siblings across the
                                                                        card, and the time box alone was taking a third of
                                                                        the width — which is what pushed a two-line address
                                                                        into four. */}
                                                                    <div className="tl-item__aside">
                                                                        <SmartTimeInput
                                                                            label={`Start time for ${item.activity || 'item'}`}
                                                                            value={item.start_time ? item.start_time.substring(0, 5) : ''}
                                                                            onChange={(newTime) => updateItem(item.id, { start_time: newTime ? newTime + ':00' : null })}
                                                                        />

                                                                        {/* A photo when Google has one worth showing, and a
                                                                            kind of thing when it does not — which is most of
                                                                            the time. */}
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
                                                                    </div>

                                                                    <div className="tl-item__main">
                                                                        {/* Editable where it is read. A stop
                                                                        named "dinner" when it was booked
                                                                        needed deleting and re-adding to
                                                                        become "dinner at Masque". */}
                                                                    <input
                                                                        className="tl-item__title"
                                                                        aria-label={`Name of ${item.activity || 'this stop'}`}
                                                                        placeholder="What is it?"
                                                                        defaultValue={item.activity || ''}
                                                                        key={`t-${item.id}`}
                                                                        onBlur={(e) => {
                                                                            const v = e.target.value.trim();
                                                                            if (v !== (item.activity || '')) {
                                                                                updateItem(item.id, { activity: v });
                                                                            }
                                                                        }}
                                                                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                                                    />

                                                                        {item.location && (
                                                                            <p className="tl-item__location">
                                                                                <GiPositionMarker aria-hidden="true" />
                                                                                {item.link ? (
                                                                                    <a href={item.link} target="_blank" rel="noopener noreferrer">{item.location}</a>
                                                                                ) : (
                                                                                    item.location
                                                                                )}
                                                                            </p>
                                                                        )}

                                                                        {/* Everything that is a fact about this stop, on one
                                                                            line that wraps rather than one line each. */}
                                                                        <div className="tl-item__meta">
                                                                            {item.place_data?.rating && (
                                                                                <span className="tl-item__rating">
                                                                                    ★ {item.place_data.rating}
                                                                                    {item.place_data.user_ratings_total ? <em>({item.place_data.user_ratings_total})</em> : null}
                                                                                </span>
                                                                            )}
                                                                            {/* Editable, like the rest of the card. It
                                                                                was the one number you could set only
                                                                                on the way in. */}
                                                                            <span className="tl-item__cost">
                                                                                <GiCoins aria-hidden="true" />
                                                                                <input
                                                                                    key={`c-${item.id}`}
                                                                                    inputMode="decimal"
                                                                                    aria-label={`Cost of ${item.activity || 'this'}`}
                                                                                    placeholder="cost"
                                                                                    defaultValue={item.cost ?? ''}
                                                                                    onBlur={(e) => {
                                                                                        const v = e.target.value.trim();
                                                                                        if (v !== String(item.cost ?? '')) {
                                                                                            updateItem(item.id, { cost: v || null });
                                                                                        }
                                                                                    }}
                                                                                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                                                                />
                                                                            <button
                                                                                type="button"
                                                                                className={`tl-item__share${item.cost_shared === false ? '' : ' is-split'}`}
                                                                                title={item.cost_shared === false
                                                                                    ? 'Each person pays this'
                                                                                    : 'Split across the party'}
                                                                                onClick={() => updateItem(item.id, { cost_shared: item.cost_shared === false })}
                                                                            >
                                                                                {item.cost_shared === false ? 'each' : 'split'}
                                                                            </button>
                                                                            </span>
                                                                            {/* How long it takes was shown but never editable
                                                                                here, so it could only be set on the way in —
                                                                                which meant it usually was not set at all. */}
                                                                            <DurationPicker
                                                                                value={item.duration}
                                                                                label={item.activity}
                                                                                onChange={(duration) => updateItem(item.id, { duration })}
                                                                            />
                                                                        </div>

                                                                        {/* The bit the title has no room for:
                                                                            the reservation name, what to order,
                                                                            which entrance. One line until she
                                                                            goes near it. */}
                                                                        <textarea
                                                                            className="tl-item__note"
                                                                            key={`n-${item.id}`}
                                                                            aria-label={`Notes on ${item.activity || 'this stop'}`}
                                                                            placeholder="Notes…"
                                                                            rows={1}
                                                                            defaultValue={item.notes || ''}
                                                                            onBlur={(e) => {
                                                                                const v = e.target.value.trim();
                                                                                if (v !== (item.notes || '')) {
                                                                                    updateItem(item.id, { notes: v || null });
                                                                                }
                                                                            }}
                                                                        />
                                                                    </div>

                                                                    {/* Top-right of the card rather than inside the title
                                                                        block, where they wrapped underneath it and read as
                                                                        part of the address. */}
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
