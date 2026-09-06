/**
 * The Ticket Book's clocks.
 *
 * The model this tests is one sentence: **a ticket's two times are wall clocks
 * at two different places, and neither is an instant.** A flight leaving San
 * Francisco at 9am and landing in New York at 6pm was six hours in the air and
 * moved three forward — and 6pm is the number worth keeping, because it is
 * what the arrivals board says and what the evening has to be planned around.
 *
 * The first version of this file got that wrong. It stored both ends as
 * `timestamptz`, which normalises them to instants: correct for a restaurant,
 * and for a flight it can tell you the gap was six hours while no longer being
 * able to tell you what time you land. Every check below exists to stop that
 * coming back.
 *
 * `TZ` is pinned to somewhere that is *not* either end of the test flights, so
 * that anything accidentally routed through `Date` shows up as a wrong answer
 * rather than passing by luck.
 */

process.env.TZ = 'Asia/Kolkata';

const {
    MODES, modeOf, faceOf, labelOf, guessMode,
    localDate, localTime, clockLabel, crossesMidnight, drawsAsBlock,
    clockMinutes, clockSpanLabel,
    routeLabel, serviceLabel, titleOf, journeyNote,
    plus, asAtlasItem, splitByClock, totalCost, totalsByCurrency, DEFAULT_LEG,
} = await import('../src/utils/journeys.js');

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

/* Her example, written exactly as the ticket writes it: no Z, no offset. Six
   hours in the air, three zones forward, nine hours off her day. */
const sfToNyc = { departs: '2026-09-16T09:00:00', arrives: '2026-09-16T18:00:00' };

console.log('\nwhat kind of journey it is:');
check('six modes, not sixty', MODES.length, 6);
check('every mode has a face and a label', MODES.every((m) => m.id && m.label && m.face), true);
check('a known mode is itself', modeOf({ mode: 'ferry' }), 'ferry');
check('an unknown mode falls back to a flight', modeOf({ mode: 'teleport' }), 'flight');
check('so does no mode at all', modeOf({}), 'flight');
check('and so does no journey at all', modeOf(null), 'flight');
check('a face comes with it', faceOf({ mode: 'train' }), '🚆');
check('and a label', labelOf({ mode: 'bus' }), 'Bus');

console.log('\nguessing from what the confirmation says:');
check('a Eurostar is a train', guessMode('Your Eurostar 9024 to Paris'), 'train');
check('so is a Caltrain', guessMode('Caltrain northbound'), 'train');
check('"training" is not', guessMode('Your training session is confirmed'), 'flight');
check('a boarding pass is a flight', guessMode('Your boarding pass, gate B12'), 'flight');
check('a sailing is a ferry', guessMode('Sailing confirmed, vessel departs'), 'ferry');
check('a coach is a bus', guessMode('FlixBus booking'), 'bus');
check('car hire is a car', guessMode('Your rental car pick-up location'), 'car');
check('nothing recognisable is still a flight', guessMode('Trip 4471'), 'flight');
check('and so is nothing at all', guessMode(''), 'flight');

console.log('\nthe times on the ticket, read as printed:');
/* The runner is in Kolkata. If any of these went through `new Date()`, a 9am
   San Francisco departure would come back as something in the evening. */
check('the departure date is the one written', localDate(sfToNyc.departs), '2026-09-16');
check('and the departure time', localTime(sfToNyc.departs), '09:00:00');
check('the landing time is the landing airport’s clock',
    clockLabel(sfToNyc.arrives), '6:00 PM');
check('morning reads as morning', clockLabel('2026-09-16T09:00:00'), '9:00 AM');
check('noon is 12 PM, not 0 PM', clockLabel('2026-09-16T12:05:00'), '12:05 PM');
check('midnight is 12 AM, not 0 AM', clockLabel('2026-09-16T00:30:00'), '12:30 AM');
// A space instead of a T is what Postgres hands back over the wire.
check('a Postgres-shaped timestamp reads the same',
    clockLabel('2026-09-16 18:00:00'), '6:00 PM');
check('nothing is not the epoch', localDate(null), null);
check('nor is an empty string', localDate(''), null);
check('and nonsense is not a date', localDate('not a date'), null);
check('an instant with a Z is still read as written, not converted',
    clockLabel('2026-09-16T18:00:00Z'), '6:00 PM');

console.log('\nwhether it can be drawn as one block:');
check('9am to 6pm on the same date can', drawsAsBlock(sfToNyc), true);
check('and it does not cross midnight', crossesMidnight(sfToNyc), false);

/* A red-eye: the ticket itself says the 17th. */
const redEye = { departs: '2026-09-16T21:40:00', arrives: '2026-09-17T06:15:00' };
check('a red-eye knows it lands tomorrow', crossesMidnight(redEye), true);
check('and cannot be one block on the departure day', drawsAsBlock(redEye), false);

/* The strange one, and a real ticket: eleven hours backwards across the date
   line, landing at an earlier clock on the same calendar day. */
const tokyoToLa = { departs: '2026-09-16T17:00:00', arrives: '2026-09-16T10:00:00' };
check('landing earlier on the same date is not a block', drawsAsBlock(tokyoToLa), false);
check('and it is not "next day" either', crossesMidnight(tokyoToLa), false);
check('a ticket with no landing time cannot be a block',
    drawsAsBlock({ departs: '2026-09-16T09:00:00' }), false);

console.log('\nhow much of the day it eats:');
/* Nine hours, on purpose. It is not the flight — the flight was six — it is
   how much of her day is gone, which is what the block is measuring. */
check('San Francisco 9am to New York 6pm is nine hours off the day',
    clockSpanLabel(sfToNyc), '9h');
check('a red-eye counts across the midnight it crosses',
    clockSpanLabel(redEye), '8h 35m');
check('a short hop is minutes alone',
    clockSpanLabel({ departs: '2026-09-16T09:00:00', arrives: '2026-09-16T09:45:00' }), '45m');
check('landing before leaving is not a negative span', clockMinutes(tokyoToLa), null);
check('no landing time is no span', clockMinutes({ departs: '2026-09-16T09:00:00' }), null);

console.log('\nwhat it is called:');
const ba = { mode: 'flight', carrier: 'United', number: 'UA 512', from_place: 'SFO', to_place: 'JFK' };
check('a route reads both ends', routeLabel(ba), 'SFO → JFK');
check('one end is still worth saying', routeLabel({ to_place: 'BOM' }), '→ BOM');
check('either end', routeLabel({ from_place: 'LHR' }), 'LHR →');
check('neither is nothing', routeLabel({}), null);
check('the service is what a board shows', serviceLabel(ba), 'United UA 512');
check('a number alone is enough', serviceLabel({ number: 'IC 512' }), 'IC 512');
check('nothing is null, not an empty string', serviceLabel({}), null);
check('a title is the route and the service', titleOf(ba), 'SFO → JFK · United UA 512');
check('with nothing to go on it says what it is', titleOf({ mode: 'ferry' }), 'Ferry booking');

console.log('\nthe line you read in a taxi:');
/* The landing leads, because it is the fact the rest of the day hangs off. */
check('the landing clock leads, and says it is local',
    journeyNote({ ...sfToNyc, ...ba, duration: '6h 05m', confirmation: 'XQ7R2P' }),
    'Lands 6:00 PM local · 6h 05m · Confirmation XQ7R2P');
check('a red-eye says next day in the note too',
    journeyNote(redEye).startsWith('Lands 6:15 AM next day local'), true);
/* Never subtracted. Nine hours beside a six-hour flight number is a figure the
   boarding pass contradicts. */
check('the flying time is the ticket’s, never the clocks’',
    journeyNote({ ...sfToNyc, duration: '6h 05m' }).includes('9h'), false);
check('and no flying time is claimed when the ticket did not say',
    journeyNote(sfToNyc), 'Lands 6:00 PM local');
check('not the service, which the title already said',
    journeyNote({ ...sfToNyc, ...ba }).includes('UA 512'), false);
check('and says nothing when there is nothing', journeyNote({}), '');

console.log('\nputting it on a day:');
{
    const item = asAtlasItem({ id: 'j1', ...sfToNyc, ...ba, cost: '486.20' });
    check('it is transport, and it is booked', [item.kind, item.booking], ['transport', 'booked']);
    check('it points at the journey', item.journey_id, 'j1');
    /* Her words: "on the timeline it should show as a block from 9 am to 6pm
       since i land 6pm time nyc". Nine hours drawn for a six-hour flight, and
       that is the correct answer. */
    check('the block runs from the clock she leaves to the clock she lands',
        [item.start_time, item.end_time], ['09:00:00', '18:00:00']);
    check('the route is the location', item.location, 'SFO → JFK');
    check('the cost comes across as a number', item.cost, 486.2);
}
{
    const item = asAtlasItem({ id: 'j2', ...redEye });
    check('a red-eye has no end time on the departure day', item.end_time, null);
    check('but it still starts when it starts', item.start_time, '21:40:00');
    check('and the note says where it lands', item.notes, 'Lands 6:15 AM next day local');
}
{
    // 17:00 → 10:00 would be a negative-height row on the timeline.
    const item = asAtlasItem({ id: 'j3', ...tokyoToLa });
    check('nor does one that lands earlier on the same date', item.end_time, null);
}
{
    // Not a guess at the journey — a guess at how much of her day it eats.
    const item = asAtlasItem({ id: 'j4', departs: '2026-09-16T09:00:00' });
    check('no landing time at all gets the default leg', item.end_time, plus('09:00:00', DEFAULT_LEG));
    check('which is ninety minutes', DEFAULT_LEG, 90);
}
check('an unpriced journey is null, not zero',
    asAtlasItem({ departs: '2026-09-16T09:00:00', cost: '' }).cost, null);
check('midnight is 00:00, never 24:00', plus('23:30:00', 30), '00:00:00');

console.log('\nheld and gone:');
{
    const now = Date.parse('2026-09-16T12:00:00Z');
    const rows = [
        { id: 'a', status: 'booked', departs: '2026-09-20T09:00:00' },
        { id: 'b', status: 'booked', departs: '2026-09-18T09:00:00' },
        // Past and never ticked off: still 'booked' in the database, history to
        // a reader. Split on the clock, not on status.
        { id: 'c', status: 'booked', departs: '2026-09-01T09:00:00' },
        { id: 'd', status: 'cancelled', departs: '2026-09-25T09:00:00' },
        { id: 'e', status: 'travelled', departs: '2026-08-01T09:00:00' },
    ];
    const { upcoming, past } = splitByClock(rows, now);
    check('what is ahead, soonest first', upcoming.map((j) => j.id), ['b', 'a']);
    check('and everything else, newest first', past.map((j) => j.id), ['d', 'c', 'e']);
    check('a cancelled future journey is not ahead of her',
        upcoming.some((j) => j.id === 'd'), false);
    check('a journey with no departure at all is history, not a crash',
        splitByClock([{ id: 'x', status: 'booked' }], now).past.map((j) => j.id), ['x']);
}

console.log('\nwhat it all cost:');
check('what the tickets came to', totalCost([{ cost: 486.2 }, { cost: 120 }, {}]), 606.2);
check('nothing costs nothing', totalCost([]), 0);
/* One number is a lie the moment two currencies are in the list, and a quiet
   one: £96 added to $1,606.20 reads as a total rather than as nonsense. */
check('two currencies stay two figures, biggest first',
    totalsByCurrency([
        { cost: 486.2, currency: 'USD' },
        { cost: 96, currency: 'GBP' },
        { cost: 1120, currency: 'usd' },
    ]),
    [{ currency: 'USD', total: 1606.2 }, { currency: 'GBP', total: 96 }]);
check('a journey that does not say is counted in the default',
    totalsByCurrency([{ cost: 40 }], 'EUR'), [{ currency: 'EUR', total: 40 }]);
check('an unpriced journey is not a zero-pound bucket',
    totalsByCurrency([{ currency: 'GBP' }, { cost: null, currency: 'GBP' }]), []);
check('nothing paid is no buckets', totalsByCurrency([]), []);

console.log('\nnothing on screen goes through Date:');
{
    /* The guard that matters most, and the one it is easy to write badly.
     *
     * The first attempt reassigned `process.env.TZ` in a loop. Node caches the
     * zone at startup and ignores it, so the check passed under four names for
     * one zone and would have caught nothing — a test that cannot fail, which
     * is worse than no test, because it reads like coverage.
     *
     * So: four real child processes, four real zones, and the whole displayed
     * surface stringified in each. Reintroduce a `new Date(ticket.arrives)`
     * anywhere on that surface and exactly one of these comes back different.
     */
    const { execFileSync } = await import('node:child_process');
    const probe = `
        const j = await import('${new URL('../src/utils/journeys.js', import.meta.url).href}');
        const sf = { departs: '2026-09-16T09:00:00', arrives: '2026-09-16T18:00:00' };
        const red = { departs: '2026-09-16T21:40:00', arrives: '2026-09-17T06:15:00' };
        console.log(JSON.stringify({
            lands: j.clockLabel(sf.arrives),
            date: j.localDate(sf.departs),
            block: j.asAtlasItem(sf),
            span: j.clockSpanLabel(sf),
            overnight: j.crossesMidnight(red),
            note: j.journeyNote(sf),
            // The shape that actually shifts under a zone if anyone reaches
            // for Date: one carrying an explicit instant.
            stamped: j.clockLabel('2026-09-16T18:00:00Z'),
        }));
    `;
    const answers = ['UTC', 'America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Kiritimati']
        .map((TZ) => execFileSync(process.execPath, ['--input-type=module', '-e', probe],
            { env: { ...process.env, TZ }, encoding: 'utf8' }).trim());

    check('four time zones, one answer', new Set(answers).size, 1);
    check('and it is the clock printed on the ticket',
        JSON.parse(answers[0]).lands, '6:00 PM');
}

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
