/**
 * The Circle: the date arithmetic and the reading-out-loud.
 *
 * Every date here is a 'YYYY-MM-DD' string and every comparison goes through
 * Date.UTC, so a birthday is never a day early because the laptop is in
 * California and the database thinks in UTC.
 */

export const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];
const SHORT = MONTHS.map((m) => m.slice(0, 3));

export const TOUCH_KINDS = [
    { id: 'in_person', label: 'In person', icon: '☕' },
    { id: 'call', label: 'Call', icon: '📞' },
    { id: 'video', label: 'Video', icon: '🎥' },
    { id: 'text', label: 'Text', icon: '💬' },
    { id: 'other', label: 'Other', icon: '✳️' },
];
export const kindOf = (id) => TOUCH_KINDS.find((k) => k.id === id) || TOUCH_KINDS[4];

const parts = (ymd) => {
    const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
    return { y, m, d };
};
const utc = (ymd) => {
    const { y, m, d } = parts(ymd);
    return Date.UTC(y, m - 1, d);
};
const pad = (n) => String(n).padStart(2, '0');
const ymdOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Whole days from a to b. Negative when b is earlier. */
export const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);

export const hasBirthday = (p) => Boolean(p?.birthday_month && p?.birthday_day);

/**
 * The next time this birthday comes round, today included. A 29 February
 * birthday is kept on the 28th in a year that has no 29th.
 */
export const nextBirthday = (person, today) => {
    if (!hasBirthday(person)) return null;
    const t = parts(today);
    const on = (year) => {
        const day = person.birthday_month === 2 && person.birthday_day === 29 && !isLeap(year)
            ? 28 : person.birthday_day;
        return ymdOf(year, person.birthday_month, day);
    };
    let date = on(t.y);
    if (daysBetween(today, date) < 0) date = on(t.y + 1);
    const year = parts(date).y;
    return {
        date,
        days: daysBetween(today, date),
        turning: person.birth_year ? year - person.birth_year : null,
    };
};

export const birthdayLabel = (person) => {
    if (!hasBirthday(person)) return '';
    const base = `${SHORT[person.birthday_month - 1]} ${person.birthday_day}`;
    return person.birth_year ? `${base}, ${person.birth_year}` : base;
};

/** "today", "tomorrow", "in 5 days", "in 3 weeks". */
export const inDaysLabel = (days) => {
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    if (days < 14) return `in ${days} days`;
    if (days < 60) return `in ${Math.round(days / 7)} weeks`;
    return `in ${Math.round(days / 30.4)} months`;
};

/** "today", "yesterday", "4 days ago", "3 weeks ago", "5 months ago", "2 years ago". */
export const sinceLabel = (date, today) => {
    if (!date) return 'never logged';
    const days = daysBetween(date, today);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 14) return `${days} days ago`;
    if (days < 60) return `${Math.round(days / 7)} weeks ago`;
    if (days < 365) return `${Math.round(days / 30.4)} months ago`;
    const years = Math.floor(days / 365);
    return years === 1 ? 'over a year ago' : `${years} years ago`;
};

/** person id -> their most recent touchpoint. */
export const lastTouchByPerson = (touchpoints = []) => {
    const out = new Map();
    touchpoints.forEach((t) => {
        const prev = out.get(t.person_id);
        if (!prev || t.happened_on > prev.happened_on
            || (t.happened_on === prev.happened_on && (t.created_at || '') > (prev.created_at || ''))) {
            out.set(t.person_id, t);
        }
    });
    return out;
};

/** Birthdays in the next `within` days, soonest first, today included. */
export const upcomingBirthdays = (people = [], today, within = 30) => people
    .map((p) => ({ person: p, next: nextBirthday(p, today) }))
    .filter((x) => x.next && x.next.days <= within)
    .sort((a, b) => a.next.days - b.next.days || a.person.name.localeCompare(b.person.name));

/**
 * Twelve months starting from this one, each with its birthdays in day order.
 * People with no birthday are left out; the caller can count them.
 */
export const birthdaysByMonth = (people = [], today) => {
    const start = parts(today).m;
    return Array.from({ length: 12 }, (_, i) => {
        const month = ((start - 1 + i) % 12) + 1;
        const list = people
            .filter((p) => p.birthday_month === month)
            .sort((a, b) => a.birthday_day - b.birthday_day || a.name.localeCompare(b.name));
        return { month, name: MONTHS[month - 1], people: list };
    });
};

/**
 * Who to catch up with. Anyone past the gap she set for them comes first,
 * most overdue at the top. Then everyone else she has ever logged, longest
 * since first. The never-logged go last, by name: an empty history is not
 * the same as a long silence.
 */
export const catchUpList = (people = [], lastBy = new Map(), today) => {
    const rows = people.map((person) => {
        const last = lastBy.get(person.id) || null;
        const since = last ? daysBetween(last.happened_on, today) : null;
        const every = person.touch_every_days || null;
        const overdueBy = every == null
            ? null
            : since == null ? every : since - every;
        return { person, last, since, every, overdue: every != null && overdueBy > 0, overdueBy };
    });
    const rank = (r) => (r.overdue ? 0 : r.since != null ? 1 : 2);
    return rows.sort((a, b) => rank(a) - rank(b)
        || (rank(a) === 0 ? b.overdueBy - a.overdueBy : 0)
        || (rank(a) === 1 ? b.since - a.since : 0)
        || a.person.name.localeCompare(b.person.name));
};

/* ---------- how people are related to each other ---------- */

/**
 * What the relation is called from the other end, when there is an obvious
 * answer. null means it reads the same both ways ("friend", "cousin").
 */
const REVERSE = {
    mom: 'child', mother: 'child', dad: 'child', father: 'child', parent: 'child',
    son: 'parent', daughter: 'parent', child: 'parent', kid: 'parent',
    sister: 'sibling', brother: 'sibling',
    grandma: 'grandchild', grandmother: 'grandchild', grandpa: 'grandchild',
    grandfather: 'grandchild', grandparent: 'grandchild', grandchild: 'grandparent',
    aunt: 'niece/nephew', uncle: 'niece/nephew', niece: 'aunt/uncle', nephew: 'aunt/uncle',
    boss: 'report', manager: 'report', report: 'manager',
    'mother-in-law': 'child-in-law', 'father-in-law': 'child-in-law',
};
export const RELATION_SUGGESTIONS = [
    'partner', 'spouse', 'husband', 'wife', 'boyfriend', 'girlfriend', 'fiancé(e)',
    'mom', 'dad', 'son', 'daughter', 'sister', 'brother', 'sibling', 'cousin',
    'grandma', 'grandpa', 'aunt', 'uncle', 'niece', 'nephew',
    'friend', 'best friend', 'roommate', 'coworker', 'manager', 'ex',
];
const PARTNERS = new Set(['husband', 'wife', 'spouse', 'partner', 'boyfriend', 'girlfriend', 'fiancé(e)', 'fiance', 'fiancee']);

/**
 * The label for the other end. A husband's other end is a partner, not a
 * husband: we don't know the other person's word, so we use the neutral one.
 */
export const reverseOf = (label) => {
    const key = String(label || '').trim().toLowerCase();
    if (!key) return null;
    if (PARTNERS.has(key)) return 'partner';
    return REVERSE[key] ?? null;
};

/**
 * Everyone linked to `personId`, each with what *they* are to this person.
 * A link stores `label` = what person_b is to person_a, and `reverse_label`
 * = what person_a is to person_b (null when it is the same word both ways).
 */
export const linksFor = (personId, links = [], peopleById = new Map()) => links
    .filter((l) => l.person_a === personId || l.person_b === personId)
    .map((l) => {
        const fromA = l.person_a === personId;
        const otherId = fromA ? l.person_b : l.person_a;
        return {
            id: l.id,
            other: peopleById.get(otherId) || null,
            otherId,
            label: fromA ? l.label : (l.reverse_label || l.label),
        };
    })
    .filter((x) => x.other)
    .sort((a, b) => a.other.name.localeCompare(b.other.name));

/** The links where both ends are inside a set of people (a group). */
export const linksWithin = (ids, links = []) => {
    const set = new Set(ids);
    return links.filter((l) => set.has(l.person_a) && set.has(l.person_b));
};

/* ---------- small helpers ---------- */

/** "jazz, ramen; the Warriors" -> ['jazz', 'ramen', 'the Warriors'], deduped. */
export const splitList = (text) => {
    const seen = new Set();
    return String(text || '')
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter((s) => {
            const k = s.toLowerCase();
            if (!s || seen.has(k)) return false;
            seen.add(k);
            return true;
        });
};

export const initials = (name) => String(name || '?')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

/** A stable hue per name, so someone's circle is the same colour every visit. */
export const hueOf = (name) => {
    let h = 0;
    for (const ch of String(name || '')) h = (h * 31 + ch.codePointAt(0)) % 360;
    return h;
};

export const matchesSearch = (person, q) => {
    const needle = String(q || '').trim().toLowerCase();
    if (!needle) return true;
    return [person.name, person.nickname, person.relation, person.city, person.how_we_met,
        person.notes, ...(person.likes || [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
};

/** Form fields -> a row for `people`. Blank strings become null. */
export const personFromForm = (f) => {
    const text = (v) => {
        const s = String(v ?? '').trim();
        return s || null;
    };
    const num = (v) => {
        const n = Number.parseInt(v, 10);
        return Number.isFinite(n) ? n : null;
    };
    let month = num(f.birthday_month);
    let day = num(f.birthday_day);
    if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) { month = null; day = null; }
    const year = num(f.birth_year);
    return {
        name: text(f.name),
        nickname: text(f.nickname),
        relation: text(f.relation),
        birthday_month: month,
        birthday_day: day,
        birth_year: month && year && year >= 1900 && year <= 2100 ? year : null,
        phone: text(f.phone),
        email: text(f.email),
        address: text(f.address),
        city: text(f.city),
        how_we_met: text(f.how_we_met),
        notes: text(f.notes),
        touch_every_days: num(f.touch_every_days) > 0 ? num(f.touch_every_days) : null,
    };
};

export const formFromPerson = (p = {}) => ({
    name: p.name || '',
    nickname: p.nickname || '',
    relation: p.relation || '',
    birthday_month: p.birthday_month ? String(p.birthday_month) : '',
    birthday_day: p.birthday_day ? String(p.birthday_day) : '',
    birth_year: p.birth_year ? String(p.birth_year) : '',
    phone: p.phone || '',
    email: p.email || '',
    address: p.address || '',
    city: p.city || '',
    how_we_met: p.how_we_met || '',
    notes: p.notes || '',
    touch_every_days: p.touch_every_days ? String(p.touch_every_days) : '',
});

export const CADENCES = [
    { days: '', label: 'No nudge' },
    { days: '7', label: 'Every week' },
    { days: '14', label: 'Every 2 weeks' },
    { days: '30', label: 'Every month' },
    { days: '90', label: 'Every 3 months' },
    { days: '180', label: 'Every 6 months' },
    { days: '365', label: 'Once a year' },
];
