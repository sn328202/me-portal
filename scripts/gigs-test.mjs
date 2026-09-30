/**
 * The Gig Book: the form-to-row mapping, the day card, the history split and
 * the paste cleaner. Run pinned to Asia/Kolkata so anything that slips
 * through `Date` shows up as a wrong answer instead of passing by luck.
 */

process.env.TZ = 'Asia/Kolkata';

import fs from 'node:fs';
const {
    asAtlasItem, gigFromForm, formFromParsed, splitByClock, seatLabel, gigNote,
    BLANK_FORM, safeLink,
} = await import('../src/utils/gigs.js');
const { cleanGig, cleanGigs } = await import('../api/gig-parse.js');
const { GIG } = await import('../src/utils/placeable.js');
const { toStop, toRow } = await import('../src/utils/dayBuild.js');
const { stateOf } = await import('../src/utils/bookingState.js');

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

console.log('form to row');
const row = gigFromForm({
    ...BLANK_FORM, name: ' Phoebe Bridgers ', venue: 'Greek Theatre', city: 'Berkeley',
    date: '2026-10-17', time: '20:00', doors: '18:30', section: '104', row: 'F',
    seat: '12-13', tickets: '2', cost: '148.5', currency: 'usd', seller: 'Ticketmaster',
});
check('name trimmed', row.name, 'Phoebe Bridgers');
check('starts is a wall clock, no zone', row.starts, '2026-10-17T20:00:00');
check('doors as a time', row.doors, '18:30:00');
check('tickets a number', row.tickets, 2);
check('currency upper', row.currency, 'USD');
check('blank cost is null, not zero', gigFromForm({ ...BLANK_FORM, name: 'x', date: '2026-10-01' }).cost, null);
check('blank cost carries no currency', gigFromForm({ ...BLANK_FORM, name: 'x', date: '2026-10-01' }).currency, null);
check('empty tickets is null', gigFromForm({ ...BLANK_FORM, name: 'x', date: '2026-10-01' }).tickets, null);

console.log('seat label');
check('numbered section', seatLabel({ section: '104', row: 'F', seat: '12-13' }), 'Sec 104 · Row F · Seats 12-13');
check('general admission', seatLabel({ section: 'GA Floor' }), 'GA Floor');
check('single seat', seatLabel({ row: 'B', seat: '7' }), 'Row B · Seat 7');
check('nothing', seatLabel({}), null);

console.log('on the day');
const gig = { id: 'g1', ...row };
const item = asAtlasItem(gig);
check('starts at doors', item.start_time, '18:30:00');
check('three hours past the show', item.end_time, '23:00:00');
check('points at the gig', item.gig_id, 'g1');
check('booked', item.booking, 'booked');
check('allowed kind', item.kind, 'other');
check('where', item.location, 'Greek Theatre, Berkeley');
check('note leads with doors and show', item.notes.startsWith('Doors 6:30 PM · Show 8:00 PM · Sec 104'), true);
const late = asAtlasItem({ name: 'Late', starts: '2026-10-17T22:30:00' });
check('a late show stops at midnight, not before it starts', [late.start_time, late.end_time], ['22:30:00', '23:59:00']);
check('doors after show are ignored', asAtlasItem({ name: 'x', starts: '2026-10-17T20:00:00', doors: '21:00:00' }).start_time, '20:00:00');
check('link only if web', [safeLink('javascript:alert(1)'), safeLink('https://tm.com/x')], [null, 'https://tm.com/x']);
check('spec date', GIG.dateOf(gig), '2026-10-17');
check('spec table', GIG.table, 'gigs');

console.log('day item round trip');
const stop = toStop({ ...item, id: 5, title: item.title });
check('stop keeps gig_id', stop.gig_id, 'g1');
check('stop is booked', stateOf(stop), 'booked');
check('row keeps gig_id', toRow(stop, { dayId: 1, userId: 'u', order: 0 }).gig_id, 'g1');

console.log('coming up and been to');
const list = [
    { id: 'a', status: 'booked', starts: '2026-10-01T20:00:00' },
    { id: 'b', status: 'booked', starts: '2026-09-30T21:00:00' },
    { id: 'c', status: 'booked', starts: '2026-09-29T20:00:00' },
    { id: 'd', status: 'went', starts: '2026-11-01T20:00:00' },
];
const { upcoming, past } = splitByClock(list, '2026-09-30');
check('tonight is still coming up', upcoming.map((g) => g.id), ['b', 'a']);
check('yesterday and settled are history', past.map((g) => g.id), ['d', 'c']);

console.log('paste cleaner');
check('needs a name and a date', cleanGig({ name: 'x' }), null);
const c = cleanGig({
    name: 'Khruangbin', date: '2026-11-02', doors: '7:00', time: '', tickets: '2',
    cost: 0, currency: 'usd', ticket_link: 'javascript:x', section: 'GA',
});
check('doors stand in for a missing show time', [c.time, c.doors], ['07:00', '07:00']);
check('zero cost is not stated', c.cost, null);
check('non-web link dropped', c.ticket_link, null);
const many = cleanGigs([
    { name: 'Fest', date: '2026-08-09', time: '12:00' },
    { name: 'Fest', date: '2026-08-08', time: '12:00' },
    { name: 'Fest', date: '2026-08-08', time: '12:00' },
    { name: 'No date', venue: 'X' },
]);
check('deduped and in date order', many.gigs.map((g) => g.date), ['2026-08-08', '2026-08-09']);
check('undatable counted', many.dropped, 1);
check('parsed fills the form', formFromParsed(c).tickets, '2');

console.log('form binds every field');
const page = fs.readFileSync(new URL('../src/pages/GigBook.jsx', import.meta.url), 'utf8');
for (const key of Object.keys(BLANK_FORM)) {
    check(`form has ${key}`, page.includes(`set('${key}')`) || page.includes(`form.${key}`), true);
}
const prompt = fs.readFileSync(new URL('../api/gig-parse.js', import.meta.url), 'utf8');
check('prompt forbids converting zones', /Never convert between\s+zones/.test(prompt), true);
check('no interpolation in the prompt', /const SYSTEM = `[^`]*\$\{/.test(prompt), false);

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
