/**
 * Keeping an Atlas day in step with the itinerary it came from.
 *
 * Sending a day plan into a trip copied its cards across and then forgot it
 * had. Change the itinerary afterwards — move dinner, drop a stop, fix a time
 * — and the only way to get the change across was to send the whole thing
 * again, which appended a second copy of everything. The dialog warned about
 * it, which is an apology rather than a fix.
 *
 * The link already existed: `day_plans.atlas_day_id` records where a plan
 * went. What was missing was the other half — which items on that day came
 * from that plan — so a re-send could not tell "replace these" from "leave
 * those alone".
 *
 * With `atlas_day_items.from_plan_id`, a sync is: delete the rows this plan
 * put on that day, insert what it says now. Anything she made in the Atlas
 * itself has a null `from_plan_id` and is never touched.
 *
 * The trade is stated rather than hidden: for the items it sent, the
 * itinerary is the source of truth. Editing one of those in the Atlas and
 * then editing the itinerary loses the Atlas edit. That is what "linked"
 * means, and it is the behaviour she asked for — the alternative is
 * reconciling two copies by hand, which is where this started.
 */

import { atlasItemsFrom } from './planToAtlas.js';

/**
 * Whether a saved plan should push its items to a trip day.
 *
 * Only when it has been sent somewhere. An itinerary that was never sent is
 * not silently adopted by a trip because its date happens to match.
 */
export const isLinked = (plan) => Boolean(plan?.atlas_day_id);

/**
 * The rows a linked plan should have on its day, right now.
 *
 * Stamped with the plan so the next sync knows which rows are its to replace.
 */
export const syncRows = (plan, planItems = [], userId) =>
    atlasItemsFrom(planItems).map((item) => ({
        ...item,
        day_id: plan.atlas_day_id,
        from_plan_id: plan.id,
        user_id: userId,
    }));

/**
 * What a sync will do, in words, for the line under the save indicator.
 *
 * Counted rather than described: "6 things" is checkable against the board in
 * front of her, and "updated" is not.
 */
export const describeSync = (rows = []) => {
    if (!rows.length) return 'The trip day is now empty too.';
    return `${rows.length} ${rows.length === 1 ? 'thing' : 'things'} kept in step with the trip.`;
};
