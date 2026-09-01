/**
 * A day, written out to send to someone.
 *
 * The itinerary editor is a working surface: input boxes, drag handles,
 * delete buttons, a brainstorm board of things that might not happen. None
 * of that is what you send your mother the week before she flies out. What
 * she wants is one page that says where to be and when, with enough of an
 * address to find it and enough of a picture to look forward to it.
 *
 * So this is not a view of the editor with the chrome hidden. It is a
 * different document built from the same rows, and the two halves of the
 * portal that hold days — a Daydream itinerary and a day of an Atlas trip —
 * both flatten into it, because a day is a day.
 *
 * Everything here is pure. The component that prints it does no thinking.
 */

import { minutesOf } from './minutes.js';
import { asMinutes } from './dayOrder.js';
import { driveMinutes } from './departAt.js';

/* An emoji per stop. Not decoration — it is the thing the eye lands on when
   someone skims the page on a phone in an airport, and it carries the kind of
   the stop faster than the words do.

   Ordered, because "coffee and pastries at the beach bakery" is breakfast
   before it is a beach. First match wins. */
const FACES = [
    [/\b(flight|fly|airport|plane|terminal|boarding|land(ing|s)?)\b/i, '✈️'],
    [/\b(train|rail|station|metro|subway|tube)\b/i, '🚆'],
    [/\b(ferry|boat|cruise|sail|kayak)\b/i, '⛴️'],
    [/\b(drive|driving|car|taxi|cab|transfer|road)\b/i, '🚗'],
    [/\b(check ?in|check ?out|hotel|hostel|airbnb|stay|guesthouse|riad|villa)\b/i, '🛏️'],
    [/\b(breakfast|brunch|pastr(y|ies)|bakery|croissant)\b/i, '🥐'],
    [/\b(coffee|espresso|cafe|café|latte|chai)\b/i, '☕'],
    [/\b(lunch)\b/i, '🥗'],
    [/\b(dinner|supper|tasting menu|restaurant)\b/i, '🍽️'],
    [/\b(drinks?|cocktails?|bar|wine|beer|aperitivo|happy hour)\b/i, '🍸'],
    [/\b(dessert|gelato|ice ?cream|cake|patisserie)\b/i, '🍨'],
    [/\b(market|bazaar|souk|shop(ping)?|boutique|mall)\b/i, '🛍️'],
    [/\b(museum|gallery|exhibit(ion)?|art)\b/i, '🖼️'],
    [/\b(temple|church|cathedral|mosque|shrine|monastery|basilica)\b/i, '🛕'],
    [/\b(castle|palace|fort|ruins?|old town|historic)\b/i, '🏛️'],
    [/\b(beach|swim|snorkel|dive|sea|shore|lagoon)\b/i, '🏖️'],
    [/\b(hike|hiking|trek|trail|walk|walking|summit|mountain)\b/i, '🥾'],
    [/\b(park|garden|botanic|forest|nature|safari|wildlife)\b/i, '🌿'],
    [/\b(spa|massage|hammam|onsen|sauna|bath)\b/i, '🧖'],
    [/\b(show|concert|gig|theatre|theater|cinema|film|movie|opera|match|game)\b/i, '🎟️'],
    [/\b(class|workshop|lesson|course|cooking class)\b/i, '🎨'],
    [/\b(sunset|sunrise|viewpoint|lookout|view)\b/i, '🌅'],
    [/\b(rest|nap|free time|downtime|chill|relax)\b/i, '😌'],
];

/** The emoji for a stop, from what she called it. Falls back to a pin. */
export const faceFor = (title, kind) => {
    const text = String(title || '');
    for (const [pattern, face] of FACES) {
        if (pattern.test(text)) return face;
    }
    // The Atlas already sorts its items into food and everything else, so
    // when the words give nothing away, that is still worth something.
    if (kind === 'food') return '🍽️';
    return '📍';
};

/** "14:05:00" -> "2:05 pm". Twelve-hour, because this is for reading. */
export const clock = (time) => {
    const mins = asMinutes(time);
    if (mins === null) return null;
    const h24 = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}`;
};

/** "90 mins" -> "1 hr 30 min". Null when there is nothing to say. */
export const spell = (duration) => {
    const mins = minutesOf(duration);
    if (!mins) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (!h) return `${m} min`;
    if (!m) return `${h} hr`;
    return `${h} hr ${m} min`;
};

/* Money, kept simple: the portal stores a bare number and no currency, so
   guessing a symbol would be inventing information. */
const money = (cost) => {
    const n = Number(cost);
    return Number.isFinite(n) && n > 0 ? n : null;
};

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * "2026-09-12" -> "Saturday, 12 September".
 *
 * Read out of the string rather than through `new Date`, which would apply a
 * timezone to a date that does not have one and hand back the day before.
 */
export const longDate = (date) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || ''));
    if (!m) return null;
    const [, y, mo, d] = m.map(Number);
    const at = new Date(Date.UTC(y, mo - 1, d));
    if (Number.isNaN(at.getTime())) return null;
    return `${dayNames[at.getUTCDay()]}, ${Number(d)} ${monthNames[mo - 1]}`;
};

/**
 * One stop, normalised.
 *
 * The two sources name things differently — a Daydream card has `activity`
 * and a `duration`, an Atlas item has a `title` and an `end_time` — and every
 * field either side of that is optional. Sorting that out here means the page
 * itself is a list of the same shape all the way down.
 */
const stopFrom = (raw) => {
    const title = String(raw.title ?? raw.activity ?? '').trim();
    if (!title) return null;

    const start = raw.start_time || null;
    // An Atlas item says when it ends; a Daydream card says how long it runs.
    const length = raw.duration
        ? spell(raw.duration)
        : (start && raw.end_time
            ? spell(`${Math.max(0, asMinutes(raw.end_time) - asMinutes(start))} mins`)
            : null);

    return {
        id: raw.id ?? title,
        face: faceFor(title, raw.kind),
        title,
        at: clock(start),
        minutes: asMinutes(start),
        length,
        place: String(raw.location || raw.address || '').trim() || null,
        link: raw.link || raw.maps_url || null,
        note: String(raw.notes || '').trim() || null,
        cost: money(raw.cost),
        // Kept out of the timed run: these are the maybes, and putting a maybe
        // between two things with times is how people miss the things with
        // times.
        loose: Boolean(raw.is_brainstorm) || !start,
    };
};

/**
 * The line between two stops: how long the hop takes, and when to set off.
 *
 * The leave-by time is the whole reason a printed day beats a list of
 * bookings — it is the one number nobody works out for themselves and the one
 * everybody wants at six o'clock.
 */
export const hopBetween = (stop, next, travel) => {
    const drive = driveMinutes(travel);
    if (drive === null || !next) return null;

    const arrive = next.minutes;
    const leave = arrive === null ? null : arrive - drive;
    return {
        travel: spell(`${drive} mins`),
        // Suppressed rather than shown negative: a drive that does not fit is
        // a planning problem, and printing "leave at -0:20" helps nobody.
        leaveBy: leave !== null && leave >= 0 ? clock(`${String(Math.floor(leave / 60)).padStart(2, '0')}:${String(leave % 60).padStart(2, '0')}:00`) : null,
    };
};

/**
 * Everything the printed page needs, from either kind of day.
 *
 * `travel` is the drive times the editor already worked out, keyed by the id
 * of the stop they lead away from — the same shape the itinerary uses on
 * screen, so nothing is looked up twice.
 */
export const dayCard = ({ title, date, subtitle, items = [], travel = {} }) => {
    const stops = items.map(stopFrom).filter(Boolean);

    const timed = stops
        .filter((s) => !s.loose)
        .sort((a, b) => (a.minutes ?? 0) - (b.minutes ?? 0));
    const loose = stops.filter((s) => s.loose);

    const hops = timed.map((stop, i) => hopBetween(stop, timed[i + 1], travel[stop.id]));

    const spend = stops.reduce((sum, s) => sum + (s.cost || 0), 0);

    const name = String(title || '').trim() || 'A day';
    const spelled = longDate(date);

    return {
        title: name,
        // A day with no name of its own is titled by its date. Printing the
        // date underneath it as well says the same thing twice in two fonts.
        date: spelled && spelled.toLowerCase() === name.toLowerCase() ? null : spelled,
        subtitle: String(subtitle || '').trim() || null,
        stops: timed,
        hops,
        loose,
        // Only worth a line if anything actually carries a price.
        spend: spend > 0 ? spend : null,
        // "9:00 am — 11:30 pm", the shape of the day in one line.
        window: timed.length
            ? [timed[0].at, timed[timed.length - 1].at].filter(Boolean).join(' – ') || null
            : null,
        empty: stops.length === 0,
    };
};

/**
 * A whole Atlas trip: one card per day that has anything on it.
 *
 * The name of a trip is its `destination` — that is the field the Atlas puts
 * her own words in. This read `name` and `title`, which no trip has ever had,
 * so every share sheet was headed "A trip" with the real name demoted to a
 * subtitle underneath it.
 */
export const tripCard = ({ trip, days = [], itemsByDay = {} }) => ({
    title: String(trip?.destination || trip?.name || trip?.title || '').trim() || 'A trip',
    // Nothing: the name is the name. A second line repeating it, or captioning
    // it with a category, is furniture.
    subtitle: null,
    days: days
        .map((d) => dayCard({
            title: d.label || d.title || longDate(d.date) || 'A day',
            date: d.date,
            subtitle: d.city || d.place || null,
            items: itemsByDay[d.id] || [],
        }))
        .filter((c) => !c.empty),
});
