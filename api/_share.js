/**
 * The part of a shared trip that decides what a stranger is allowed to see.
 *
 * Split out of the route so it can be run against a fake Supabase client that
 * records every query. The things that would leak a trip — a query missing
 * its owner scope, a revoked token being served, the token itself coming back
 * in the payload — are then assertions rather than hopes.
 */

/* Shape only. A token that cannot be a token is not worth a database round
   trip, and refusing it here keeps junk out of the query. */
export const looksLikeToken = (t) =>
    typeof t === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(t);

/**
 * Read one trip, whole, for a share row that has already been found.
 *
 * Every read is scoped by *both* the trip id on the share row and the owner
 * recorded on it. The owner scope is redundant while trip ids are unique —
 * which is exactly why it is worth having, because the day that stops being
 * true this is what stops the leak.
 */
export const readTrip = async (sb, share) => {
    const { trip_id: tripId, user_id: owner } = share;

    const mine = (table) => sb.from(table).select('*').eq('trip_id', tripId).eq('user_id', owner);

    const [trip, days, legs, stays, ideas, waypoints] = await Promise.all([
        sb.from('atlas_trips').select('*').eq('id', tripId).eq('user_id', owner).maybeSingle(),
        mine('atlas_days').order('date'),
        mine('atlas_legs').order('sort_order'),
        mine('atlas_stays').order('check_in'),
        mine('atlas_ideas').order('sort_order'),
        mine('atlas_waypoints'),
    ]);

    if (trip.error || !trip.data) return null;

    /* Day items hang off days rather than the trip, so they are fetched by the
       day ids we just proved belong to this trip. A trip with no days must not
       become an unfiltered read of everybody's items, so it does not ask. */
    const dayIds = (days.data || []).map((d) => d.id);
    const items = dayIds.length
        ? await sb.from('atlas_day_items').select('*')
            .in('day_id', dayIds).eq('user_id', owner)
            .order('start_time', { nullsFirst: false })
        : { data: [] };

    return {
        // Never the token, never the owner's id. The page needs neither, and a
        // page that does not hold a secret cannot spill one.
        canEdit: !!share.can_edit,
        trip: trip.data,
        days: days.data || [],
        items: items.data || [],
        legs: legs.data || [],
        stays: stays.data || [],
        ideas: ideas.data || [],
        waypoints: waypoints.data || [],
    };
};
