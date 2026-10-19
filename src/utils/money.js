/**
 * Money in more than one currency, and who paid for what.
 *
 * A cost keeps the amount and currency it was charged in. `fx_rate` is USD per
 * one unit of that currency, and the USD figure is always amount × rate — so
 * editing the amount can never leave a stale dollar figure behind. A USD
 * figure typed by hand is stored as the rate it implies.
 *
 * Shares and payments are kept in USD, in cents while adding up.
 */

const cents = (v) => Math.round((Number(v) || 0) * 100);
const units = (c) => Math.round(c) / 100;

export const BASE = 'USD';

/** The currency a row was charged in. Missing means USD. */
export const currencyOf = (row) => String(row?.currency || BASE).trim().toUpperCase() || BASE;

export const isForeign = (row) => currencyOf(row) !== BASE;

/** The row's cost in USD, or null when it has no cost or no rate yet. */
export const usdOf = (row) => {
    if (row?.cost === null || row?.cost === undefined || row?.cost === '') return null;
    const amount = Number(row.cost);
    if (!Number.isFinite(amount)) return null;
    if (!isForeign(row)) return amount;
    const rate = Number(row.fx_rate);
    return rate > 0 ? units(cents(amount * rate)) : null;
};

/** A foreign cost with no rate: it cannot be counted until it has one. */
export const needsRate = (row) => isForeign(row) && Number(row?.cost) > 0 && !(Number(row?.fx_rate) > 0);

/** The rate a hand-typed USD figure implies. */
export const rateFor = (amount, usd) => {
    const a = Number(amount);
    const u = Number(usd);
    return a > 0 && u >= 0 ? u / a : null;
};

/**
 * Each traveler's share of one cost, in cents.
 *
 * `owed` null means an equal split among everyone on the trip. Equal splits
 * that do not divide evenly give the spare cents to the first names, so the
 * shares always add back up to the cost exactly.
 */
export const sharesOf = (usd, owed, travelers = []) => {
    const total = cents(usd);
    const out = {};
    if (Array.isArray(owed) && owed.length) {
        for (const o of owed) if (o?.name) out[o.name] = (out[o.name] || 0) + cents(o.usd);
        return out;
    }
    const people = travelers.filter(Boolean);
    if (!people.length) return out;
    const each = Math.floor(total / people.length);
    let spare = total - each * people.length;
    for (const name of people) {
        out[name] = each + (spare > 0 ? 1 : 0);
        if (spare > 0) spare -= 1;
    }
    return out;
};

/** An equal split among some of the travelers, as an `owed` list. */
export const equalAmong = (usd, names = []) => {
    const shares = sharesOf(usd, null, names);
    return names.map((name) => ({ name, usd: units(shares[name] || 0) }));
};

/**
 * Everyone's paid, share and balance across a trip's costs.
 *
 * `costs` are `{ key, usd, split }` where split is a cost_splits row or null.
 * A cost nobody has been recorded as paying is left out of the balances —
 * counting its shares with no payer would put everyone in debt to nobody —
 * and counted in `unpaid` instead so the gap is visible.
 */
export const balances = (costs = [], travelers = []) => {
    const people = new Map();
    const touch = (name) => {
        if (!people.has(name)) people.set(name, { name, paid: 0, share: 0 });
        return people.get(name);
    };
    for (const name of travelers) touch(name);

    let unpaid = 0;
    let unpaidCount = 0;
    for (const cost of costs) {
        if (!(cost.usd > 0)) continue;
        const paid = (cost.split?.paid || []).filter((p) => p?.name && Number(p.usd) > 0);
        if (!paid.length) { unpaid += cents(cost.usd); unpaidCount += 1; continue; }
        for (const p of paid) touch(p.name).paid += cents(p.usd);
        const shares = sharesOf(cost.usd, cost.split?.owed, travelers);
        for (const [name, c] of Object.entries(shares)) touch(name).share += c;
    }

    const rows = [...people.values()].map((p) => ({
        name: p.name, paid: units(p.paid), share: units(p.share), net: units(p.paid - p.share),
    }));
    return { people: rows, unpaid: units(unpaid), unpaidCount };
};

/**
 * Who pays whom to settle up, in as few payments as a greedy match gives.
 * Amounts under a cent are ignored.
 */
export const settleUp = (people = []) => {
    const owe = people.filter((p) => p.net < -0.005).map((p) => ({ name: p.name, c: -cents(p.net) }));
    const get = people.filter((p) => p.net > 0.005).map((p) => ({ name: p.name, c: cents(p.net) }));
    owe.sort((a, b) => b.c - a.c);
    get.sort((a, b) => b.c - a.c);
    const out = [];
    let i = 0;
    let j = 0;
    while (i < owe.length && j < get.length) {
        const c = Math.min(owe[i].c, get[j].c);
        if (c > 0) out.push({ from: owe[i].name, to: get[j].name, usd: units(c) });
        owe[i].c -= c;
        get[j].c -= c;
        if (owe[i].c === 0) i += 1;
        if (get[j].c === 0) j += 1;
    }
    return out;
};

/** Do the recorded payments add up to the cost? Returns the gap in USD (+ = underpaid). */
export const paidGap = (usd, paid = []) => units(cents(usd) - paid.reduce((s, p) => s + cents(p?.usd), 0));

/** Same, for custom shares. */
export const owedGap = (usd, owed = []) => units(cents(usd) - (owed || []).reduce((s, o) => s + cents(o?.usd), 0));
