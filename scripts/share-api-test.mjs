/**
 * What a share link is allowed to hand over.
 *
 * This endpoint is deliberately unauthenticated, so the usual safety net —
 * "RLS will catch it" — is not there. The queries themselves are the whole
 * protection, which makes them worth asserting rather than reading.
 *
 * The client below records every call, so each test is a question about what
 * was actually asked of the database.
 */
import assert from 'node:assert/strict';
import { looksLikeToken, readTrip } from '../api/_share.js';

let n = 0;
const t = async (name, fn) => { await fn(); n += 1; console.log(`  ok  ${name}`); };

const OWNER = 'owner-uuid';
const OTHER = 'somebody-else';

/* A Supabase client that answers nothing and remembers everything. */
const spy = (rows = {}) => {
    const calls = [];
    const from = (table) => {
        const call = { table, eq: {}, in: {}, ordered: [] };
        calls.push(call);
        const chain = {
            select() { return chain; },
            eq(col, val) { call.eq[col] = val; return chain; },
            in(col, vals) { call.in[col] = vals; return chain; },
            order(col) { call.ordered.push(col); return chain; },
            maybeSingle: async () => ({ data: rows[table]?.[0] ?? null }),
            then: (ok) => ok({ data: rows[table] ?? [] }),
        };
        return chain;
    };
    return { from, calls };
};

const TRIP = { id: 42, destination: 'Florence', user_id: OWNER };
const rows = {
    atlas_trips: [TRIP],
    atlas_days: [{ id: 'd1', user_id: OWNER }, { id: 'd2', user_id: OWNER }],
    atlas_day_items: [{ id: 'i1', day_id: 'd1', title: 'Uffizi' }],
    atlas_legs: [], atlas_stays: [], atlas_ideas: [], atlas_waypoints: [],
};
const share = { token: 'x'.repeat(43), trip_id: 42, user_id: OWNER, can_edit: false };

/* ---- the token ------------------------------------------------------- */

await t('a trip id is not a token', () => {
    // The first thing anybody tries.
    assert.equal(looksLikeToken('42'), false);
    assert.equal(looksLikeToken('1'), false);
});

await t('nor is anything shorter than 32 characters', () => {
    assert.equal(looksLikeToken('a'.repeat(31)), false);
    assert.ok(looksLikeToken('a'.repeat(32)));
});

await t('and nothing carrying a path or a query gets through', () => {
    assert.equal(looksLikeToken(`${'a'.repeat(40)}/../../etc`), false);
    assert.equal(looksLikeToken(`${'a'.repeat(40)}&x=1`), false);
    assert.equal(looksLikeToken(`${'a'.repeat(40)} or 1=1`), false);
    assert.equal(looksLikeToken(null), false);
    assert.equal(looksLikeToken(undefined), false);
});

/* ---- the reads ------------------------------------------------------- */

await t('every table is asked for one trip and one owner', async () => {
    const sb = spy(rows);
    await readTrip(sb, share);

    for (const call of sb.calls) {
        if (call.table === 'atlas_day_items') continue; // by day id; checked below
        assert.equal(call.eq.user_id, OWNER, `${call.table} was not scoped to the owner`);
        const key = call.table === 'atlas_trips' ? 'id' : 'trip_id';
        assert.equal(call.eq[key], 42, `${call.table} was not scoped to the trip`);
    }
});

await t('day items are asked for by the days of this trip, and its owner', async () => {
    const sb = spy(rows);
    await readTrip(sb, share);
    const items = sb.calls.find((c) => c.table === 'atlas_day_items');
    assert.deepEqual(items.in.day_id, ['d1', 'd2']);
    assert.equal(items.eq.user_id, OWNER);
});

await t('a trip with no days does not ask for items at all', async () => {
    // `.in('day_id', [])` is a filter that matches nothing, but a *missing*
    // filter is a read of everybody's items. The safe branch is not asking.
    const sb = spy({ ...rows, atlas_days: [] });
    const out = await readTrip(sb, share);
    assert.equal(sb.calls.some((c) => c.table === 'atlas_day_items'), false);
    assert.deepEqual(out.items, []);
});

await t('a share row pointing at a trip that is not the owner\'s yields nothing', async () => {
    // The trip read is scoped by owner, so a share row with the wrong owner
    // finds no trip — and no trip means no bundle, not a bundle with holes.
    const sb = spy({ ...rows, atlas_trips: [] });
    assert.equal(await readTrip(sb, { ...share, user_id: OTHER }), null);
});

/* ---- what comes back ------------------------------------------------- */

await t('the payload never carries the token or the owner', async () => {
    const sb = spy(rows);
    const out = await readTrip(sb, share);
    const text = JSON.stringify(out);
    assert.equal(text.includes(share.token), false, 'the token came back to the page');
    assert.equal(Object.hasOwn(out, 'user_id'), false);
    assert.equal(Object.hasOwn(out, 'token'), false);
});

await t('and it says plainly whether this link may edit', async () => {
    const sb = spy(rows);
    assert.equal((await readTrip(sb, share)).canEdit, false);
    assert.equal((await readTrip(spy(rows), { ...share, can_edit: true })).canEdit, true);
});

await t('a trip that has gone missing is nothing, not a half-trip', async () => {
    const sb = spy({ ...rows, atlas_trips: [] });
    assert.equal(await readTrip(sb, share), null);
});

console.log(`\nshare API: ${n} passed`);
