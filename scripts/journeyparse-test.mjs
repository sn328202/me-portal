/**
 * Reading a pasted confirmation.
 *
 * Two halves, and only one of them can be tested without a model. This is the
 * half that can: everything between the model's answer and the row that gets
 * written. It matters more than it looks, because the model is allowed to be
 * vague — a missing arrival date, a lowercase currency, the same flight listed
 * twice in a summary block at the bottom of the email — and none of that is
 * allowed to reach the database.
 *
 * The other half, whether the model converts time zones, cannot be asserted
 * here. It is pinned in the system prompt and checked against real
 * confirmation shapes by hand; the greps at the bottom make sure the
 * instruction that does it cannot be deleted quietly.
 */

process.env.TZ = 'Asia/Kolkata';

import fs from 'node:fs';
const { cleanLeg, cleanLegs } = await import('../api/journey-parse.js');
const { formFromLeg, journeyFromForm, legSummary, BLANK_FORM, stamp } =
    await import('../src/utils/journeys.js');

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

/* Her example as a model would hand it back: two local clocks, no offsets. */
const sfToNyc = {
    mode: 'flight', carrier: 'United', number: 'UA 512',
    from_place: 'SFO', to_place: 'JFK',
    depart_date: '2026-09-16', depart_time: '09:00',
    arrive_date: '2026-09-16', arrive_time: '18:00',
    confirmation: 'XQ7R2P', duration: '6h 05m', cost: 486.2, currency: 'usd',
};

console.log('\ncleaning one leg:');
{
    const leg = cleanLeg(sfToNyc);
    check('both clocks survive exactly as given',
        [leg.depart_time, leg.arrive_time], ['09:00', '18:00']);
    check('the currency is normalised, the cost is not',
        [leg.currency, leg.cost], ['USD', 486.2]);
    check('the flying time is kept as written', leg.duration, '6h 05m');
}
// A leg with no departure is not a leg; everything else may be missing.
check('no departure date is not a leg', cleanLeg({ depart_time: '09:00' }), null);
check('no departure time is not a leg', cleanLeg({ depart_date: '2026-09-16' }), null);
check('a departure alone is enough',
    cleanLeg({ depart_date: '2026-09-16', depart_time: '09:00' })?.depart_time, '09:00');
check('a mode it does not know becomes a flight',
    cleanLeg({ mode: 'zeppelin', depart_date: '2026-09-16', depart_time: '09:00' }).mode, 'flight');
check('9:05 is padded to 09:05',
    cleanLeg({ depart_date: '2026-09-16', depart_time: '9:05' }).depart_time, '09:05');
check('a 25th hour is not a time',
    cleanLeg({ depart_date: '2026-09-16', depart_time: '25:00' }), null);
check('a date that is not a date is not a date',
    cleanLeg({ depart_date: '16 Sept 2026', depart_time: '09:00' }), null);
/* Leaving the arrival date off is how a confirmation says "same day". */
check('an arrival time with no date lands the same day',
    cleanLeg({ depart_date: '2026-09-16', depart_time: '09:00', arrive_time: '18:00' }).arrive_date,
    '2026-09-16');
check('no arrival time means no arrival date either',
    cleanLeg({ depart_date: '2026-09-16', depart_time: '09:00', arrive_date: '2026-09-17' }).arrive_date,
    null);
// A free leg and an unrecorded one are different facts.
check('a zero fare is not a price', cleanLeg({ ...sfToNyc, cost: 0 }).cost, null);
check('and no price means no currency to hang on it',
    cleanLeg({ ...sfToNyc, cost: null }).currency, null);
check('whitespace is not a carrier', cleanLeg({ ...sfToNyc, carrier: '   ' }).carrier, null);

console.log('\ncleaning a whole booking:');
{
    /* A real round trip with a connection on the way out, handed back out of
       order — models list the summary block in whatever order it appears. */
    const booking = cleanLegs([
        { ...sfToNyc, number: 'UA 512' },
        { mode: 'flight', carrier: 'United', number: 'UA 934', from_place: 'JFK', to_place: 'LHR',
            depart_date: '2026-09-16', depart_time: '21:15', arrive_date: '2026-09-17',
            arrive_time: '09:30', confirmation: 'XQ7R2P' },
        { mode: 'flight', carrier: 'United', number: 'UA 935', from_place: 'LHR', to_place: 'SFO',
            depart_date: '2026-09-28', depart_time: '11:00', arrive_date: '2026-09-28',
            arrive_time: '14:20', confirmation: 'XQ7R2P' },
        // The same outbound flight again, from the itinerary summary at the
        // bottom of the email. Two identical rows is two identical journeys.
        { ...sfToNyc, number: 'UA 512' },
        // A layover is not a leg, but a model may try; with no departure of
        // its own it cannot become one.
        { mode: 'other', notes: '3h 45m layover at JFK' },
    ]);

    check('a connection is two legs, not one', booking.length, 3);
    check('and they come back in travel order',
        booking.map((l) => l.number), ['UA 512', 'UA 934', 'UA 935']);
    check('the duplicate from the summary block is dropped',
        booking.filter((l) => l.number === 'UA 512').length, 1);
    check('the return is not lost',
        booking.some((l) => l.from_place === 'LHR' && l.to_place === 'SFO'), true);
    check('the overnight leg keeps its next-day arrival',
        booking[1].arrive_date, '2026-09-17');
    check('the reference is on every leg',
        booking.every((l) => l.confirmation === 'XQ7R2P'), true);
}
check('nothing found is an empty list, not a crash', cleanLegs(), []);
check('and so is something that is not a list', cleanLegs('legs'), []);
check('a booking of nothing but layovers finds nothing',
    cleanLegs([{ mode: 'other', notes: 'wait' }]), []);

console.log('\na leg into the form and out again:');
{
    const form = formFromLeg(cleanLeg(sfToNyc));
    check('the form holds every box it needs',
        Object.keys(form).sort(), Object.keys(BLANK_FORM).sort());
    /* Blank is what "same day" looks like in the form. Pre-filling it makes
       every ordinary flight look like it needed the red-eye field. */
    check('a same-day arrival leaves the second date box empty', form.arrive_date, '');

    const row = journeyFromForm(form);
    check('and the row that comes out is the ticket, unchanged',
        [row.departs, row.arrives], ['2026-09-16T09:00:00', '2026-09-16T18:00:00']);
    check('no Z, no offset, nothing that names a zone',
        /[Zz]|[+]\d{2}:\d{2}$/.test(row.departs + row.arrives), false);
    check('the cost comes across as a number', row.cost, 486.2);
}
{
    // The red-eye: the only case where the second date box is filled.
    const form = formFromLeg(cleanLeg({
        ...sfToNyc, depart_time: '21:15', arrive_date: '2026-09-17', arrive_time: '09:30',
    }));
    check('a next-day arrival does fill the second date box', form.arrive_date, '2026-09-17');
    check('and survives the round trip to a row',
        journeyFromForm(form).arrives, '2026-09-17T09:30:00');
}
check('a leg with no arrival makes a row with no arrival',
    journeyFromForm(formFromLeg({ depart_date: '2026-09-16', depart_time: '09:00' })).arrives, null);
check('an unpriced leg is null, not zero',
    journeyFromForm(formFromLeg({ depart_date: '2026-09-16', depart_time: '09:00' })).cost, null);
check('two boxes make one wall clock', stamp('2026-09-16', '18:00'), '2026-09-16T18:00:00');
check('and a missing box makes none', stamp('2026-09-16', ''), null);

console.log('\nthe line she ticks:');
check('everything load-bearing in one glance',
    legSummary(cleanLeg(sfToNyc)),
    'SFO → JFK · 9:00 AM · → 6:00 PM · United UA 512');
check('a red-eye says so, because that is the one worth double-checking',
    legSummary(cleanLeg({ ...sfToNyc, depart_time: '21:15', arrive_date: '2026-09-17', arrive_time: '06:15' })),
    'SFO → JFK · 9:15 PM · → 6:15 AM next day · United UA 512');
check('a leg that says almost nothing still reads',
    legSummary(cleanLeg({ depart_date: '2026-09-16', depart_time: '09:00' })),
    'Somewhere · 9:00 AM');

console.log('\nevery box the form claims to have:');
{
    /* This exists because it caught a real one. `duration` was added to the
       table, to the parser, to the row writer and to the commit message that
       said she could type it — and the edit that added the input to the form
       silently did not apply. Everything downstream worked, so nothing failed;
       there was simply no box. A field in `BLANK_FORM` that nothing binds to
       is a field she cannot fill in. */
    const page = fs.readFileSync('src/pages/TicketBook.jsx', 'utf8');
    const missing = Object.keys(BLANK_FORM).filter((key) => !(
        page.includes(`value={form.${key}}`) || page.includes(`form.${key} === `)
        || page.includes(`aria-checked={form.${key}`)
    ));
    check('nothing in the form is unreachable', missing, []);
}

console.log('\nthe instruction that keeps the clocks honest:');
{
    /* Not a style check. The prompt is the only thing standing between a
       helpful model and a normalised departure time, and it is exactly the
       sort of paragraph that gets trimmed by someone tidying up. */
    const src = fs.readFileSync('api/journey-parse.js', 'utf8');
    check('the prompt still forbids converting between zones',
        /Never convert a time between zones/.test(src), true);
    check('and still spells the example out in digits',
        /09:00.*18:00/s.test(src), true);
    check('it still asks for one entry per segment',
        /ONE ENTRY PER SEGMENT/.test(src), true);
    check('and still refuses to subtract the two clocks',
        /Do not subtract the two clocks/.test(src), true);
    /* A stray backtick inside a prompt template literal broke `api/capture.js`
       at parse time twice. That failure at least announces itself — the build
       stops. The one that does not announce itself is `${...}`: an
       interpolation in a system prompt is a silent hole where anything in
       scope can be spliced into the model's instructions, and it reads like
       ordinary text on the page. The prompt is a constant; keep it one. */
    const opens = src.indexOf('const SYSTEM = `');
    const prompt = src.slice(opens, src.indexOf('`;', opens));
    check('nothing is interpolated into the system prompt',
        prompt.includes('\${'), false);
}

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
