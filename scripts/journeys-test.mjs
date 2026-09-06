/**
 * The Ticket Book's arithmetic.
 *
 * Every interesting function here is about a boundary: midnight, a time zone,
 * or an end that is missing. A red-eye read as landing the same evening, or a
 * Tokyo → Los Angeles flight read as taking minus eight hours, are both wrong
 * in a way that looks completely reasonable on the page — which is exactly the
 * kind of wrong that needs a test rather than a look.
 *
 * The date functions are deliberately tested through the *local* zone the
 * runner is in, because the bug they exist to prevent is a UTC reading of a
 * local evening. `TZ` is pinned below so the assertions mean the same thing on
 * her Mac, in CI and in this container.
 */

process.env.TZ = 'America/Los_Angeles';

const {
    MODES, modeOf, faceOf, labelOf, guessMode,
    localDate, localTime, crossesMidnight, minutesOf, durationLabel,
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

console.log('\nwhat kind of journey it is:');
check('six modes, not sixty', MODES.length, 6);
check('every mode has a face and a label',
    MODES.every((m) => m.id && m.label && m.face), true);
check('a known mode is itself', modeOf({ mode: 'ferry' }), 'ferry');
// Most of them are, and a booking that will not say is not a reason to refuse it.
check('an unknown mode falls back to a flight', modeOf({ mode: 'teleport' }), 'flight');
check('so does no mode at all', modeOf({}), 'flight');
check('and so does no journey at all', modeOf(null), 'flight');
check('a face comes with it', faceOf({ mode: 'train' }), '🚆');
check('and a label', labelOf({ mode: 'bus' }), 'Bus');

console.log('\nguessing from what the confirmation says:');
check('a Eurostar is a train', guessMode('Your Eurostar 9024 to Paris'), 'train');
// "Caltrain" and "Eurostar service" are what confirmations actually say; the
// bare word "train" mostly is not.
check('so is a Caltrain', guessMode('Caltrain northbound'), 'train');
check('"training" is not', guessMode('Your training session is confirmed'), 'flight');
check('a boarding pass is a flight', guessMode('Your boarding pass, gate B12'), 'flight');
check('a sailing is a ferry', guessMode('Sailing confirmed, vessel departs'), 'ferry');
check('a coach is a bus', guessMode('FlixBus booking'), 'bus');
check('car hire is a car', guessMode('Your rental car pick-up location'), 'car');
// Everything in this book is transport already, so an unreadable name is a
// plane by volume — a different claim from `guessKind`, which shrugs.
check('nothing recognisable is still a flight', guessMode('Trip 4471'), 'flight');
check('and so is nothing at all', guessMode(''), 'flight');

console.log('\nthe two clocks:');
/* 9pm in Los Angeles is 04:00 the next day in UTC. `toISOString().slice(0,10)`
   would call this the 17th, send it to a day that is not the day she is
   flying, and land it there without complaint. */
const redEye = {
    depart_at: '2026-09-16T21:40:00-07:00',
    arrive_at: '2026-09-17T06:15:00-04:00',
};
check('the departure date is the local one', localDate(redEye.depart_at), '2026-09-16');
check('and the local time', localTime(redEye.depart_at), '21:40:00');
check('a red-eye knows it lands tomorrow', crossesMidnight(redEye), true);
check('and how long it took', durationLabel(redEye), '5h 35m');

const sameDay = {
    depart_at: '2026-09-16T09:00:00-07:00',
    arrive_at: '2026-09-16T10:30:00-07:00',
};
check('a hop does not cross midnight', crossesMidnight(sameDay), false);
check('and reads in hours and minutes', durationLabel(sameDay), '1h 30m');
check('a short one is minutes alone',
    durationLabel({ depart_at: '2026-09-16T09:00:00-07:00', arrive_at: '2026-09-16T09:45:00-07:00' }), '45m');
check('a round one drops the minutes',
    durationLabel({ depart_at: '2026-09-16T09:00:00-07:00', arrive_at: '2026-09-16T16:00:00-07:00' }), '7h');

/* The whole reason both ends are instants rather than wall clocks: this one
   lands at an earlier clock time than it left, on the same calendar day. Nine
   hours — 17:00 in Tokyo is 08:00 UTC, 10:00 in Los Angeles is 17:00 UTC —
   and a wall-clock subtraction would have called it minus seven. */
const westward = {
    depart_at: '2026-09-16T17:00:00+09:00',
    arrive_at: '2026-09-16T10:00:00-07:00',
};
check('crossing the date line is still a positive number', minutesOf(westward), 540);
check('and does not read as landing before it left', crossesMidnight(westward), false);

check('no arrival is no duration', minutesOf({ depart_at: '2026-09-16T09:00:00Z' }), null);
check('and no label for one', durationLabel({ depart_at: '2026-09-16T09:00:00Z' }), null);
// `new Date(null)` is the epoch, not an invalid date — an absent value has to
// be turned away before it becomes 1 Jan 1970.
check('nothing is not the epoch', localDate(null), null);
check('nor is an empty string', localDate(''), null);
check('and nonsense is not a date', localDate('not a date'), null);

console.log('\nwhat it is called:');
const ba = {
    mode: 'flight', carrier: 'British Airways', number: 'BA 286',
    from_place: 'LHR', to_place: 'SFO',
};
check('a route reads both ends', routeLabel(ba), 'LHR → SFO');
check('one end is still worth saying', routeLabel({ to_place: 'BOM' }), '→ BOM');
check('either end', routeLabel({ from_place: 'LHR' }), 'LHR →');
check('neither is nothing', routeLabel({}), null);
check('the service is what a board shows', serviceLabel(ba), 'British Airways BA 286');
check('a number alone is enough', serviceLabel({ number: 'IC 512' }), 'IC 512');
check('nothing is null, not an empty string', serviceLabel({}), null);
// A journey has no `name` column on purpose: its identity is its route.
check('a title is the route and the service', titleOf(ba), 'LHR → SFO · British Airways BA 286');
check('with nothing to go on it says what it is', titleOf({ mode: 'ferry' }), 'Ferry booking');

console.log('\nthe line you read in a taxi:');
check('the note carries the code and the overnight warning',
    journeyNote({ ...redEye, ...ba, confirmation: 'XQ7R2P', baggage: '1 checked 23kg' }),
    '5h 35m · Arrives next day · Confirmation XQ7R2P · 1 checked 23kg');
/* Not the carrier and number: `titleOf` is drawn directly above this note
   everywhere it appears, and it already ends in them. */
check('and not the service, which the title already said',
    journeyNote({ ...redEye, ...ba }).includes('BA 286'), false);
check('and says nothing when there is nothing', journeyNote({}), '');

console.log('\nputting it on a day:');
{
    const item = asAtlasItem({ id: 'j1', ...sameDay, ...ba, cost: '486.20' });
    check('it is transport, and it is booked', [item.kind, item.booking], ['transport', 'booked']);
    // Points at the journey rather than copying it, so editing the booking
    // changes what the day shows. A separate column from `booked_id`, which is
    // a foreign key to `reservations`.
    check('it points at the journey', item.journey_id, 'j1');
    check('it runs departure to arrival', [item.start_time, item.end_time], ['09:00:00', '10:30:00']);
    check('the route is the location', item.location, 'LHR → SFO');
    check('the cost comes across as a number', item.cost, 486.2);
}
{
    /* An arrival on a later date cannot be an end time on this day's clock —
       06:15 as the end of a 21:40 block is a negative-height row on the
       timeline — so it is left off and the note says so in words. */
    const item = asAtlasItem({ id: 'j2', ...redEye });
    check('an overnight leg has no end time on this day', item.end_time, null);
    check('but it still starts when it starts', item.start_time, '21:40:00');
    check('and the note admits it', item.notes.includes('Arrives next day'), true);
}
{
    // Not a guess at the journey — a guess at how much of her day it eats.
    const item = asAtlasItem({ id: 'j3', depart_at: '2026-09-16T09:00:00-07:00' });
    check('no arrival gets the default leg',
        item.end_time, plus('09:00:00', DEFAULT_LEG));
    check('which is ninety minutes', DEFAULT_LEG, 90);
}
check('an unpriced journey is null, not zero',
    asAtlasItem({ depart_at: '2026-09-16T09:00:00Z', cost: '' }).cost, null);
check('midnight is 00:00, never 24:00', plus('23:30:00', 30), '00:00:00');

console.log('\nheld and gone:');
{
    const now = new Date('2026-09-16T12:00:00-07:00').getTime();
    const rows = [
        { id: 'a', status: 'booked', depart_at: '2026-09-20T09:00:00-07:00' },
        { id: 'b', status: 'booked', depart_at: '2026-09-18T09:00:00-07:00' },
        // Past and never ticked off: still 'booked' in the database, history
        // to a reader. Split on the clock, not on status.
        { id: 'c', status: 'booked', depart_at: '2026-09-01T09:00:00-07:00' },
        { id: 'd', status: 'cancelled', depart_at: '2026-09-25T09:00:00-07:00' },
        { id: 'e', status: 'travelled', depart_at: '2026-08-01T09:00:00-07:00' },
    ];
    const { upcoming, past } = splitByClock(rows, now);
    check('what is ahead, soonest first', upcoming.map((j) => j.id), ['b', 'a']);
    check('and everything else, newest first', past.map((j) => j.id), ['d', 'c', 'e']);
    check('a cancelled future journey is not ahead of her',
        upcoming.some((j) => j.id === 'd'), false);
}
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

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
