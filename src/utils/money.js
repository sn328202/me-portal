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

/** Which part of the trip a cost belongs to, for "covers only the hotels". */
export const BUCKETS = [
    { id: 'lodging', label: 'Hotels' },
    { id: 'transport', label: 'Flights & travel' },
    { id: 'food', label: 'Food' },
    { id: 'excursions', label: 'Activities & other' },
];
const KIND_BUCKET = { lodging: 'lodging', transport: 'transport', food: 'food', todo: 'excursions', other: 'excursions' };
export const bucketOf = (cost) => (cost?.source === 'stay' ? 'lodging' : KIND_BUCKET[cost?.row?.kind || cost?.kind] || 'excursions');

/**
 * Whose wallet a person's share of a cost comes out of.
 *
 * A rule says "payer covers person" for everything or for some buckets.
 * Followed through (Dad covers Neha, who covers Nadia's hotels: Nadia's hotel
 * lands on Dad). A loop leaves the share with the person themselves.
 */
export const responsibleFor = (name, bucket, rules = []) => {
    const seen = new Set([name]);
    let who = name;
    for (;;) {
        const rule = rules.find((r) => r?.person === who && r?.payer && r.payer !== who
            && (r.buckets || []).some((b) => b === 'all' || b === bucket));
        if (!rule) return who;
        // A loop (A covers B covers A) means nobody really covers it.
        if (seen.has(rule.payer)) return name;
        seen.add(rule.payer);
        who = rule.payer;
    }
};

/**
 * Everyone's share, who covers it, what they paid, and where they stand.
 *
 * `costs` are `{ usd, split, bucket }` (split is a cost_splits row or null).
 *
 * - `share`: what was spent on this person — every priced cost, paid yet or not.
 * - `responsible`: what comes out of their pocket — their own share unless
 *   someone covers it, plus the shares of the people they cover.
 * - `coveredBy` / `covers`: who picked up whose share, by name.
 * - `net`: paid minus what they are responsible for, counting only costs
 *   that have a payer recorded. A cost nobody has paid yet would otherwise
 *   put everyone in debt to nobody; it is counted in `unpaid` instead.
 */
export const balances = (costs = [], travelers = [], rules = [], sent = []) => {
    const people = new Map();
    const touch = (name) => {
        if (!people.has(name)) {
            people.set(name, { name, paid: 0, share: 0, responsible: 0, due: 0, coveredBy: {}, covers: {} });
        }
        return people.get(name);
    };
    for (const name of travelers) touch(name);

    let unpaid = 0;
    let unpaidCount = 0;
    for (const cost of costs) {
        if (!(cost.usd > 0)) continue;
        const bucket = cost.bucket || bucketOf(cost);
        const paid = (cost.split?.paid || []).filter((p) => p?.name && Number(p.usd) > 0);
        const settled = paid.length > 0;
        if (!settled) { unpaid += cents(cost.usd); unpaidCount += 1; }
        for (const p of paid) touch(p.name).paid += cents(p.usd);

        const shares = sharesOf(cost.usd, cost.split?.owed, travelers);
        for (const [name, c] of Object.entries(shares)) {
            const who = touch(name);
            who.share += c;
            const payer = responsibleFor(name, bucket, rules);
            const resp = touch(payer);
            resp.responsible += c;
            if (settled) resp.due += c;
            if (payer !== name) {
                who.coveredBy[payer] = (who.coveredBy[payer] || 0) + c;
                resp.covers[name] = (resp.covers[name] || 0) + c;
            }
        }
    }

    /* Money sent between people outside any cost ("Dad has already sent me
       $2,200"): it counts as paid in by the sender and taken out by the
       person who received it, so settling up shrinks by exactly that much. */
    for (const t of sentList(sent)) {
        touch(t.from).paid += cents(t.usd);
        touch(t.to).paid -= cents(t.usd);
    }

    const asUnits = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, units(v)]));
    const rows = [...people.values()].map((p) => ({
        name: p.name,
        share: units(p.share),
        responsible: units(p.responsible),
        paid: units(p.paid),
        net: units(p.paid - p.due),
        coveredBy: asUnits(p.coveredBy),
        covers: asUnits(p.covers),
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

/**
 * Why each person's balance is what it is, cost by cost — the thing to send
 * someone along with "you owe me $3,875".
 *
 * For every person, `charges` lists each cost where who paid is recorded and
 * the shares they are responsible for in it (their own, and anyone they
 * cover), and `payments` lists what they put in. Only costs with a payer
 * recorded are included, so the totals here match the balance exactly.
 */
export const statements = (costs = [], travelers = [], rules = [], sent = []) => {
    const out = new Map();
    const touch = (name) => {
        if (!out.has(name)) out.set(name, { name, charges: [], payments: [], charged: 0, paid: 0 });
        return out.get(name);
    };
    for (const name of travelers) touch(name);

    for (const cost of costs) {
        if (!(cost.usd > 0)) continue;
        const paid = (cost.split?.paid || []).filter((p) => p?.name && Number(p.usd) > 0);
        if (!paid.length) continue;
        const bucket = cost.bucket || bucketOf(cost);

        const perPayer = new Map();
        const shares = sharesOf(cost.usd, cost.split?.owed, travelers);
        for (const [name, c] of Object.entries(shares)) {
            if (!c) continue;
            const payer = responsibleFor(name, bucket, rules);
            if (!perPayer.has(payer)) perPayer.set(payer, []);
            perPayer.get(payer).push({ name, usd: units(c) });
        }
        for (const [payer, people] of perPayer) {
            const sum = people.reduce((s, p) => s + cents(p.usd), 0);
            const who = touch(payer);
            who.charges.push({ key: cost.key, title: cost.title, when: cost.when, total: cost.usd, people, usd: units(sum) });
            who.charged += sum;
        }
        for (const p of paid) {
            const who = touch(p.name);
            who.payments.push({ key: cost.key, title: cost.title, when: cost.when, usd: units(cents(p.usd)) });
            who.paid += cents(p.usd);
        }
    }

    for (const t of sentList(sent)) {
        const c = cents(t.usd);
        const when = t.date ? shortDay(t.date) : '';
        const from = touch(t.from);
        from.payments.push({ key: `sent-${t.id}`, title: `Sent to ${t.to}${t.note ? ` (${t.note})` : ''}`, when, usd: units(c) });
        from.paid += c;
        const to = touch(t.to);
        to.payments.push({ key: `got-${t.id}`, title: `Received from ${t.from}${t.note ? ` (${t.note})` : ''}`, when, usd: units(-c) });
        to.paid -= c;
    }

    return [...out.values()].map((s) => ({
        ...s, charged: units(s.charged), paid: units(s.paid), net: units(s.paid - s.charged),
    }));
};

/** Money sent between people, cleaned: a sender, a different receiver, and a positive USD amount. */
export const sentList = (sent = []) => (Array.isArray(sent) ? sent : [])
    .filter((t) => t?.from && t?.to && t.from !== t.to && Number(t.usd) > 0);

const shortDay = (d) => {
    const t = new Date(`${String(d).slice(0, 10)}T12:00:00`);
    return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

/** A plain-text version of one person's statement, to paste into a message. */
export const statementText = (s, transfers = [], tripName = 'the trip', fmt = (n) => `$${n.toFixed(2)}`) => {
    const lines = [`${tripName}: ${s.name}'s share`, ''];
    for (const c of s.charges) {
        const who = c.people.length === 1 && c.people[0].name === s.name
            ? ''
            : ` (${c.people.map((p) => `${p.name} ${fmt(p.usd)}`).join(', ')})`;
        lines.push(`${c.title}: ${fmt(c.usd)}${who}`);
    }
    lines.push(`Total share: ${fmt(s.charged)}`);
    if (s.payments.length) {
        lines.push('', 'Already paid:');
        for (const p of s.payments) lines.push(`${p.title}: ${p.usd < 0 ? `-${fmt(-p.usd)}` : fmt(p.usd)}`);
        lines.push(`Total paid: ${s.paid < 0 ? `-${fmt(-s.paid)}` : fmt(s.paid)}`);
    }
    lines.push('');
    const out = transfers.filter((t) => t.from === s.name);
    const back = transfers.filter((t) => t.to === s.name);
    for (const t of out) lines.push(`${s.name} pays ${t.to} ${fmt(t.usd)}`);
    for (const t of back) lines.push(`${t.from} pays ${s.name} ${fmt(t.usd)}`);
    if (!out.length && !back.length) lines.push('All square.');
    return lines.join('\n');
};
