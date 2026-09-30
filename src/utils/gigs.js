/**
 * The Gig Book — concert tickets.
 *
 * A gig is a name, a venue, a night and a seat. The times are wall clocks at
 * the venue, stored exactly as the ticket prints them, for the same reason as
 * the Ticket Book: an 8pm show in Chicago is at 8pm in Chicago, and building a
 * `Date` from it would re-apply whichever zone the browser is in. Everything
 * shown here reads the printed digits.
 */

import {
    localDate, localTime, clockLabel, stamp, plus, totalsByCurrency,
} from './journeys.js';

export { localDate, clockLabel, stamp, totalsByCurrency };

/** How much of the evening a show takes when nothing says where it ends. */
export const DEFAULT_SHOW = 180;

const LAST_MINUTE = '23:59:00';

/** "7:00 PM" from a bare time of day like "19:00:00". */
export const timeLabel = (time) => (time ? clockLabel(`2000-01-01T${String(time).slice(0, 5)}`) : null);

/** "Sec 104 · Row F · Seats 12–13", "GA Floor", or null. */
export const seatLabel = (g) => {
    const section = String(g?.section || '').trim();
    const row = String(g?.row || '').trim();
    const seat = String(g?.seat || '').trim();
    const bits = [];
    if (section) bits.push(/^\d+$/.test(section) ? `Sec ${section}` : section);
    if (row) bits.push(`Row ${row}`);
    if (seat) bits.push(/[-–,&]| and /.test(seat) ? `Seats ${seat}` : `Seat ${seat}`);
    return bits.join(' · ') || null;
};

/** "Metro, Chicago" — whichever of the two is known. */
export const placeLabel = (g) => [
    String(g?.venue || '').trim() || null,
    String(g?.city || '').trim() || null,
].filter(Boolean).join(', ') || null;

export const titleOf = (g) => String(g?.name || '').trim() || 'A gig';

/** "2 tickets", or null for one or none. */
export const ticketsLabel = (g) => (Number(g?.tickets) > 1 ? `${Number(g.tickets)} tickets` : null);

/**
 * The line under the name on the day: doors and show first, because they are
 * what the rest of the evening hangs off, then where she is sitting, then the
 * confirmation.
 */
export const gigNote = (g) => {
    const bits = [];
    const doors = timeLabel(g?.doors);
    const show = clockLabel(g?.starts);
    if (doors) bits.push(`Doors ${doors}`);
    if (show) bits.push(`Show ${show}`);
    if (g?.support) bits.push(`with ${String(g.support).trim()}`);
    const seat = seatLabel(g);
    if (seat) bits.push(seat);
    const count = ticketsLabel(g);
    if (count) bits.push(count);
    if (g?.confirmation) bits.push(`Confirmation ${g.confirmation}`);
    if (g?.seller) bits.push(`via ${g.seller}`);
    if (g?.notes) bits.push(g.notes);
    return bits.join(' · ');
};

/**
 * A gig as a row of `atlas_day_items`.
 *
 * The block starts at doors when the ticket gives them — that is when she has
 * to be there — and runs three hours past the show. A late show that would
 * run past midnight stops at 23:59 rather than drawing a block that ends
 * before it starts.
 */
export const asAtlasItem = (g) => {
    const show = localTime(g?.starts);
    const doors = g?.doors ? `${String(g.doors).slice(0, 5)}:00` : null;
    const start = doors && show && doors < show ? doors : show;
    let end = show ? plus(show, DEFAULT_SHOW) : null;
    if (end && start && end <= start) end = LAST_MINUTE;
    return {
        title: titleOf(g),
        kind: 'other',
        icon: '🎤',
        booking: 'booked',
        gig_id: g?.id || null,
        start_time: start,
        end_time: end,
        location: placeLabel(g),
        link: safeLink(g?.ticket_link),
        notes: gigNote(g) || null,
        cost: g?.cost === null || g?.cost === undefined || g?.cost === '' ? null : Number(g.cost),
    };
};

/** Coming up and been to, split on the clock rather than on status. */
const roughly = (value) => {
    const day = localDate(value);
    const time = localTime(value);
    if (!day || !time) return null;
    const t = Date.parse(`${day}T${time}Z`);
    return Number.isNaN(t) ? null : t;
};

/**
 * A gig stays "coming up" until the day after it. The clock carries no zone,
 * so comparing to the minute would be a few hours out either way; comparing to
 * the day is honest, and a show tonight should not drop into history at 8pm.
 */
export const splitByClock = (gigs = [], today = new Date().toLocaleDateString('en-CA')) => {
    const at = (g) => roughly(g.starts);
    const ahead = (g) => (localDate(g.starts) || '') >= today;
    return {
        upcoming: gigs
            .filter((g) => g.status === 'booked' && at(g) !== null && ahead(g))
            .sort((a, b) => at(a) - at(b)),
        past: gigs
            .filter((g) => g.status !== 'booked' || at(g) === null || !ahead(g))
            .sort((a, b) => at(b) - at(a)),
    };
};

export const SELLERS = ['Ticketmaster', 'AXS', 'Live Nation', 'SeatGeek', 'StubHub', 'Dice', 'Eventbrite', 'See Tickets', 'Venue box office'];

export const BLANK_FORM = {
    name: '', support: '', venue: '', city: '',
    date: '', time: '20:00', doors: '',
    section: '', row: '', seat: '', tickets: '',
    cost: '', currency: 'USD', seller: '', ticket_link: '',
    confirmation: '', notes: '',
};

/** A parsed ticket as the form holds it. */
export const formFromParsed = (p = {}) => ({
    ...BLANK_FORM,
    name: p.name || '',
    support: p.support || '',
    venue: p.venue || '',
    city: p.city || '',
    date: p.date || '',
    time: p.time || '20:00',
    doors: p.doors || '',
    section: p.section || '',
    row: p.row || '',
    seat: p.seat || '',
    tickets: p.tickets ? String(p.tickets) : '',
    cost: p.cost === null || p.cost === undefined ? '' : String(p.cost),
    currency: p.currency || 'USD',
    seller: p.seller || '',
    ticket_link: p.ticket_link || '',
    confirmation: p.confirmation || '',
    notes: p.notes || '',
});

const text = (v) => String(v ?? '').trim() || null;

/** The form as a row. The one place its boxes become stored values. */
export const gigFromForm = (form = {}) => {
    const count = parseInt(form.tickets, 10);
    const hasCost = !(form.cost === '' || form.cost === null || form.cost === undefined);
    return {
        name: text(form.name),
        support: text(form.support),
        venue: text(form.venue),
        city: text(form.city),
        starts: stamp(form.date, form.time || '20:00'),
        doors: form.doors ? `${String(form.doors).slice(0, 5)}:00` : null,
        section: text(form.section),
        row: text(form.row),
        seat: text(form.seat),
        tickets: Number.isFinite(count) && count > 0 ? count : null,
        cost: hasCost ? Number(form.cost) : null,
        currency: hasCost ? (text(form.currency)?.toUpperCase() || null) : null,
        seller: text(form.seller),
        ticket_link: text(form.ticket_link),
        confirmation: text(form.confirmation),
        notes: text(form.notes),
    };
};

/** A ticket link only if it is a web address — it ends up in an href. */
export const safeLink = (url) => (/^https?:\/\/\S+$/i.test(String(url || '').trim()) ? String(url).trim() : null);
