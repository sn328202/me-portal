/**
 * Fixture tests for the iCalendar parser.
 *
 * Recurrence and folding are the two things that silently swallow events, and
 * "the calendar looks empty" is indistinguishable from "the feed is broken"
 * from the outside — so both are pinned here rather than discovered live.
 */
import { parseCalendar, unfold, parseDate, expandRecurrence, isFreeBusyOnly } from '../api/_ics.js';

let failed = 0;
const check = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failed += 1;
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${ok ? '' : `\n         got ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`}`);
};

const ics = (body) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-CALNAME:Personal\r\n${body}\r\nEND:VCALENDAR`;
const ms = (s) => new Date(s).getTime();

const WINDOW = { from: ms('2026-08-01T00:00:00Z'), to: ms('2026-09-30T00:00:00Z') };

console.log('\nunfold():');
check('joins a continuation line', unfold('SUMMARY:A very long ti\r\n tle here'), 'SUMMARY:A very long title here');
check('leaves ordinary lines alone', unfold('A\r\nB'), 'A\nB');

console.log('\nparseDate():');
check('all-day has no time component', parseDate('20260821', { VALUE: 'DATE' }),
    { date: ms('2026-08-21T00:00:00Z'), allDay: true });
check('bare 8 digits is all-day too', parseDate('20260821').allDay, true);
check('UTC timestamp', parseDate('20260821T090000Z'),
    { date: ms('2026-08-21T09:00:00Z'), allDay: false });
check('garbage is null', parseDate('nonsense'), null);

console.log('\nexpandRecurrence():');
{
    const start = ms('2026-08-03T17:00:00Z');   // a Monday
    const weekly = expandRecurrence(start, 'FREQ=WEEKLY', WINDOW.from, ms('2026-08-31T00:00:00Z'));
    check('weekly repeats', weekly.length, 4);
    check('  and keeps the time of day', new Date(weekly[1]).toISOString(), '2026-08-10T17:00:00.000Z');
}
{
    const start = ms('2026-08-03T17:00:00Z');
    const counted = expandRecurrence(start, 'FREQ=DAILY;COUNT=3', WINDOW.from, WINDOW.to);
    check('COUNT is respected', counted.length, 3);
}
{
    const start = ms('2026-08-03T17:00:00Z');
    const until = expandRecurrence(start, 'FREQ=WEEKLY;UNTIL=20260817T000000Z', WINDOW.from, WINDOW.to);
    check('UNTIL is respected', until.length, 2);
}
{
    const start = ms('2026-08-03T17:00:00Z');
    const skipped = expandRecurrence(start, 'FREQ=WEEKLY', WINDOW.from, ms('2026-08-31T00:00:00Z'), [ms('2026-08-10T17:00:00Z')]);
    check('EXDATE removes one occurrence', skipped.length, 3);
}
{
    const start = ms('2026-08-03T17:00:00Z');
    const byday = expandRecurrence(start, 'FREQ=WEEKLY;BYDAY=MO,WE', WINDOW.from, ms('2026-08-17T00:00:00Z'));
    check('BYDAY gives several days a week', byday.length, 4);
}
{
    const start = ms('2026-08-03T17:00:00Z');
    check('an unsupported FREQ falls back to one occurrence',
        expandRecurrence(start, 'FREQ=SECONDLY', WINDOW.from, WINDOW.to), [start]);
}

console.log('\nparseCalendar():');
{
    const { calendarName, events } = parseCalendar(ics(
        'BEGIN:VEVENT\r\nUID:a\r\nSUMMARY:Dentist\r\nDTSTART:20260812T160000Z\r\nDTEND:20260812T170000Z\r\nLOCATION:Sutter St\r\nEND:VEVENT'
    ), WINDOW);
    check('reads the calendar name', calendarName, 'Personal');
    check('one event', events.length, 1);
    check('title', events[0].title, 'Dentist');
    check('location', events[0].location, 'Sutter St');
    check('end derived from DTEND', events[0].end, '2026-08-12T17:00:00.000Z');
}
{
    const { events } = parseCalendar(ics(
        'BEGIN:VEVENT\r\nUID:b\r\nSUMMARY:Standup\r\nDTSTART:20260803T160000Z\r\nDTEND:20260803T161500Z\r\nRRULE:FREQ=WEEKLY;COUNT=3\r\nEND:VEVENT'
    ), WINDOW);
    check('a recurring event expands', events.length, 3);
    check('  each keeps its 15 minute length',
        new Date(events[0].end) - new Date(events[0].start), 15 * 60 * 1000);
    check('  ids are unique per occurrence', new Set(events.map((e) => e.id)).size, 3);
}
{
    const { events } = parseCalendar(ics(
        'BEGIN:VEVENT\r\nUID:c\r\nSUMMARY:Gone\r\nSTATUS:CANCELLED\r\nDTSTART:20260812T160000Z\r\nEND:VEVENT'
    ), WINDOW);
    check('cancelled events are dropped', events.length, 0);
}
{
    const { events } = parseCalendar(ics(
        'BEGIN:VEVENT\r\nUID:d\r\nSUMMARY:Way off\r\nDTSTART:20200101T160000Z\r\nEND:VEVENT'
    ), WINDOW);
    check('events outside the window are dropped', events.length, 0);
}
{
    const { events } = parseCalendar(ics(
        'BEGIN:VEVENT\r\nUID:e\r\nSUMMARY:Long confer\r\n ence call with the team\r\nDTSTART:20260812T160000Z\r\nEND:VEVENT'
    ), WINDOW);
    check('folded title is rejoined', events[0].title, 'Long conference call with the team');
}
{
    const { events } = parseCalendar(ics(
        'BEGIN:VEVENT\r\nUID:f\r\nSUMMARY:Trip\r\nDTSTART;VALUE=DATE:20260815\r\nDTEND;VALUE=DATE:20260816\r\nEND:VEVENT'
    ), WINDOW);
    check('all-day is flagged', events[0].allDay, true);
    check('  and lands on the right date', events[0].start.slice(0, 10), '2026-08-15');
}
{
    const { events } = parseCalendar(ics(
        'BEGIN:VEVENT\r\nUID:g\r\nSUMMARY:Escaped\\, comma\r\nDTSTART:20260812T160000Z\r\nEND:VEVENT'
    ), WINDOW);
    check('escaped commas are unescaped', events[0].title, 'Escaped, comma');
}
{
    const { events } = parseCalendar(ics(
        'BEGIN:VEVENT\r\nUID:h\r\nSUMMARY:Second\r\nDTSTART:20260820T160000Z\r\nEND:VEVENT\r\n'
        + 'BEGIN:VEVENT\r\nUID:i\r\nSUMMARY:First\r\nDTSTART:20260810T160000Z\r\nEND:VEVENT'
    ), WINDOW);
    check('sorted by start', events.map((e) => e.title), ['First', 'Second']);
}

console.log('\nisFreeBusyOnly() — the diagnosis for Neha\'s calendar:');
check('all "Busy" is free/busy sharing', isFreeBusyOnly([{ title: 'Busy' }, { title: 'Busy' }]), true);
check('real titles are not', isFreeBusyOnly([{ title: 'Busy' }, { title: 'Dentist' }]), false);
check('an empty calendar is not', isFreeBusyOnly([]), false);

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
