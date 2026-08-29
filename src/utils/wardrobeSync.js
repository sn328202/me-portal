/**
 * Keeping the Wardrobe in two places at once, safely.
 *
 * The outfit planner is eighty kilobytes of working HTML in an iframe. It has
 * always read and written `localStorage` and there is no good reason to rewrite
 * it. What there is no excuse for is that being the *only* copy: a closet of
 * about forty items, built by hand, one "clear site data" away from gone.
 *
 * So the planner keeps its localStorage and the portal mirrors those six keys
 * into Postgres. That means two copies, and two copies mean a rule for which
 * one wins. The rule here is deliberately timid: **when in doubt, push, never
 * pull.** Pushing at worst writes a value the server already had. Pulling at
 * worst overwrites work she just did.
 */

/** The six keys the planner actually persists. Nothing else is mirrored. */
export const WARDROBE_KEYS = [
    'trips',
    'profiles',
    'activeProfile',
    'closets',
    'essAll',
    'essCatsAll',
];

/** The planner namespaces everything; the database does not need to. */
export const localKey = (key) => `op_${key}`;

/** Where the portal remembers what it last agreed with the server. */
export const META_KEY = 'op_synced_at';

const time = (v) => {
    const t = Date.parse(v || '');
    return Number.isFinite(t) ? t : null;
};

// Two structures are the same if they serialise the same. The planner writes
// through JSON.stringify already, so this is comparing like with like.
const same = (a, b) => {
    try {
        return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    } catch {
        return false;
    }
};

/**
 * What should happen to one key.
 *
 * `local`   — what this browser holds, already parsed (undefined = nothing).
 * `remote`  — the row from the database, or undefined.
 * `syncedAt`— when this browser last agreed with the server, ISO or null.
 *
 * Returns 'push', 'pull' or 'rest'.
 */
export const decide = ({ local, remote, syncedAt }) => {
    const here = local !== undefined && local !== null;
    const there = remote !== undefined && remote !== null;

    // The rescue. The browser is the only copy there has ever been.
    if (here && !there) return 'push';

    // A browser that has never seen this wardrobe takes what the server has.
    if (!here && there) return 'pull';

    if (!here && !there) return 'rest';

    if (same(local, remote.value)) return 'rest';

    // They differ, so somebody edited something. If this browser has never
    // agreed with the server, its copy is the older story and the server wins;
    // otherwise anything changed since that agreement is hers, now, in front
    // of her, and it goes up.
    const agreed = time(syncedAt);
    if (agreed === null) return 'pull';

    const stamped = time(remote.updated_at);
    if (stamped !== null && stamped > agreed) return 'pull';

    return 'push';
};

/**
 * What should happen to all of them.
 *
 * `locals`  — { key: parsed value }
 * `rows`    — the rows as they came back from the database
 * `syncedAt`— ISO string or null
 */
export const plan = ({ locals = {}, rows = [], syncedAt = null } = {}) => {
    const byKey = {};
    rows.forEach((r) => { if (r && r.key) byKey[r.key] = r; });

    const push = [];
    const pull = [];

    WARDROBE_KEYS.forEach((key) => {
        const call = decide({ local: locals[key], remote: byKey[key], syncedAt });
        if (call === 'push') push.push(key);
        else if (call === 'pull') pull.push(key);
    });

    return { push, pull };
};

/** Read the planner's keys out of a Storage, parsed, skipping anything unreadable. */
export const readLocal = (store) => {
    const out = {};
    WARDROBE_KEYS.forEach((key) => {
        try {
            const raw = store?.getItem?.(localKey(key));
            if (raw === null || raw === undefined) return;
            out[key] = JSON.parse(raw);
        } catch {
            // A key that will not parse is a key the planner would also have
            // given up on. Leaving it out means it is treated as absent, which
            // is the safe reading.
        }
    });
    return out;
};

/** Put a value back where the planner will find it. */
export const writeLocal = (store, key, value) => {
    try {
        store?.setItem?.(localKey(key), JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
};

/** A line she can read to know it worked. */
export const describeSync = ({ push = [], pull = [] } = {}, closetCount = null) => {
    const bits = [];
    if (push.length) bits.push(`saved ${push.length} ${push.length === 1 ? 'thing' : 'things'} to your account`);
    if (pull.length) bits.push(`brought ${pull.length} down from your account`);

    if (!bits.length) return 'Your wardrobe is backed up.';

    const head = bits.join(' and ');
    const tail = closetCount === null ? '' : ` — ${closetCount} ${closetCount === 1 ? 'item' : 'items'} in the closet.`;
    return `${head[0].toUpperCase()}${head.slice(1)}${tail}`;
};

/** How many garments are in the closet, across everyone. */
export const closetSize = (closets) => {
    if (!closets || typeof closets !== 'object') return 0;
    return Object.values(closets).reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0);
};
