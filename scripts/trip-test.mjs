/**
 * Trip cost and weather-labelling tests.
 *
 * The cost maths is the part that must never be quietly wrong. A spreadsheet
 * that is off by a few percent gets trusted anyway, because nothing about it
 * looks broken — you find out at the end of the trip.
 */
import {
    perPerson, dayCost, tripCost, formatMoney, COST_BUCKETS,
    nightsOf, lodgingByNight, stayOn,
} from '../src/utils/tripCosts.js';
import { datesBetween } from '../src/utils/tripDates.js';
import { daysOfLeg, legOn, routeGaps, summariseLegs } from '../src/utils/tripLegs.js';
import { describeCode, dressFor, isForecastable, sourceLabel } from '../src/utils/weather.js';

let failed = 0;
const check = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failed += 1;
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${ok ? '' : `\n         got  ${JSON.stringify(actual)}\n         want ${JSON.stringify(expected)}`}`);
};

const day = (over = {}) => ({
    id: 'd1', date: '2026-12-16',
    cost_lodging: 0, cost_food: 0, cost_excursions: 0, cost_transport: 0, cost_points: 0,
    costs_are_shared: false, ...over,
});

console.log('\nperPerson():');
check('a per-person figure is not divided', perPerson(60, false, 3), 6000);
check('a shared figure is', perPerson(60, true, 3), 2000);
check('a party of one divides by one', perPerson(60, true, 1), 6000);
check('a missing party size does not divide by zero', perPerson(60, true, 0), 6000);
check('a party size of null is one person', perPerson(60, true, null), 6000);
check('rubbish is worth nothing', perPerson('abc', true, 2), 0);

console.log('\ndayCost() — the five lines from the sheet:');
{
    const d = day({ cost_lodging: 240, cost_food: 60, costs_are_shared: true });
    const { buckets, total } = dayCost(d, [], 3);
    check('a shared room splits three ways', buckets.lodging, 8000);
    check('so does the food', buckets.food, 2000);
    check('and the day totals per person', total, 10000);
}
{
    const d = day({ cost_lodging: 80, cost_food: 20, costs_are_shared: false });
    check('per-person entry is left alone', dayCost(d, [], 3).total, 10000);
}

console.log('\ndayCost() — priced slots, which the sheet could not do:');
{
    const d = day({ cost_food: 30, costs_are_shared: false });
    const items = [
        { kind: 'food', cost: 60, cost_shared: true },     // dinner for the party
        { kind: 'todo', cost: 25, cost_shared: false },    // a ticket each
        { kind: 'other', cost: null },                     // unpriced, ignored
        { kind: 'transport', cost: '', cost_shared: true },// blank, ignored
    ];
    const { buckets, total } = dayCost(d, items, 2);
    check('a shared meal splits and adds to the food line', buckets.food, 3000 + 3000);
    check('a per-head ticket lands whole in excursions', buckets.excursions, 2500);
    check('unpriced slots contribute nothing', buckets.transport, 0);
    check('the day total is the sum', total, 8500);
}
{
    const items = [{ kind: 'nonsense', cost: 10, cost_shared: false }];
    check('an unknown kind falls into excursions',
        dayCost(day(), items, 1).buckets.excursions, 1000);
    check('cost_shared defaults to shared when unset',
        dayCost(day(), [{ kind: 'food', cost: 10 }], 2).buckets.food, 500);
}

console.log('\ntripCost() — the running total:');
{
    const days = [
        day({ id: 'b', date: '2026-12-17', cost_food: 50 }),
        day({ id: 'a', date: '2026-12-16', cost_lodging: 100 }),
        day({ id: 'c', date: '2026-12-18', cost_transport: 25 }),
    ];
    const result = tripCost(days, {}, 1);
    check('days are put in date order', result.days.map((d) => d.id), ['a', 'b', 'c']);
    check('the running total runs forwards',
        result.days.map((d) => d.runningTotal), [100, 150, 175]);
    check('each bucket totals across the trip',
        [result.totals.lodging, result.totals.food, result.totals.transport], [100, 50, 25]);
    check('per person', result.perPerson, 175);
    check('and what the party actually pays', tripCost(days, {}, 3).party, 525);
}
{
    // Thirds are where a naive float total drifts, and a drifting total is the
    // kind of wrong that is never noticed until the trip is over.
    const days = Array.from({ length: 21 }, (_, i) => day({
        id: `d${i}`, date: `2026-12-${String(i + 1).padStart(2, '0')}`,
        cost_food: 10, costs_are_shared: true,
    }));
    const result = tripCost(days, {}, 3);
    check('21 days of $10 split three ways does not drift', result.perPerson, 70);
}
check('an empty trip costs nothing', tripCost([], {}, 2).perPerson, 0);
check('every bucket is present even when empty',
    Object.keys(tripCost([day()], {}, 1).totals), COST_BUCKETS);

console.log('\nformatMoney():');
check('whole amounts lose the decimals', formatMoney(1240, 'USD'), '$1,240');
check('pennies are kept when there are any', formatMoney(1240.5, 'USD'), '$1,240.50');
check('an unknown currency does not throw', formatMoney(10, 'NOTACURRENCY'), 'NOTACURRENCY 10.00');

console.log('\nweather labelling:');
check('code 0 is clear', describeCode(0).label, 'Clear');
check('code 61 is rain', describeCode(61).label, 'Rain');
check('code 95 is thunderstorms', describeCode(95).label, 'Thunderstorms');
check('an unknown code does not throw', describeCode(999).label, '—');

check('hot', dressFor(90, 78), 'Hot — lightest things you own');
check('mild', dressFor(66, 55), 'Mild — long sleeves');
check('freezing', dressFor(20, 10), 'Freezing — coat, hat, gloves');
check('a big overnight swing is called out',
    dressFor(75, 45), 'Warm — short sleeves, and layers — it drops 30° overnight');
check('no temperature, no advice', dressFor(null, null), null);
check('  an empty string is absence too', dressFor('', ''), null);
check('  and zero is a real temperature', dressFor(0, -10), 'Freezing — coat, hat, gloves');
check('  a missing low just omits the layers note', dressFor(75, null), 'Warm — short sleeves');

{
    const today = new Date('2026-08-27T12:00:00');
    check('a date next week is forecastable', isForecastable('2026-09-01', today), true);
    check('a date in December is not', isForecastable('2026-12-16', today), false);
    check('yesterday still counts', isForecastable('2026-08-26', today), true);
    check('rubbish is not', isForecastable('not-a-date', today), false);
}

check('a forecast says so', sourceLabel({ source: 'forecast' }), 'forecast');
check('an average says how many years',
    sourceLabel({ source: 'normal', years: 10 }), 'typical for these dates (10-year average)');
check('no weather, no caption', sourceLabel(null), null);

console.log('\nnightsOf() — lodging spans, and checkout is not a night:');
check('16th to 19th is three nights',
    nightsOf({ check_in: '2026-12-16', check_out: '2026-12-19' }),
    ['2026-12-16', '2026-12-17', '2026-12-18']);
check('one night', nightsOf({ check_in: '2026-12-16', check_out: '2026-12-17' }), ['2026-12-16']);
check('same day is no nights at all',
    nightsOf({ check_in: '2026-12-16', check_out: '2026-12-16' }), []);
check('backwards is no nights',
    nightsOf({ check_in: '2026-12-19', check_out: '2026-12-16' }), []);
check('a stay across new year still counts right',
    nightsOf({ check_in: '2026-12-31', check_out: '2027-01-02' }), ['2026-12-31', '2027-01-01']);
check('missing dates are no nights', nightsOf({}), []);

console.log('\nlodgingByNight() — a booking spread over its nights:');
{
    const stays = [{ id: 's1', name: 'Andaz', check_in: '2026-12-16', check_out: '2026-12-19', cost: 1260, cost_shared: true }];
    const nightly = lodgingByNight(stays, 3);
    check('three nights, three people, $1,260',
        [nightly['2026-12-16'], nightly['2026-12-17'], nightly['2026-12-18']],
        [14000, 14000, 14000]);
    check('and nothing on the checkout morning', nightly['2026-12-19'], undefined);
    check('a per-head rate is not divided again',
        lodgingByNight([{ ...stays[0], cost_shared: false }], 3)['2026-12-16'], 42000);
    check('two overlapping stays both count',
        lodgingByNight([
            { check_in: '2026-12-16', check_out: '2026-12-17', cost: 100, cost_shared: false },
            { check_in: '2026-12-16', check_out: '2026-12-17', cost: 50, cost_shared: false },
        ], 1)['2026-12-16'], 15000);
}

console.log('\nstayOn():');
{
    const stays = [{ id: 's1', name: 'Andaz', check_in: '2026-12-16', check_out: '2026-12-19' }];
    check('a covered night finds its stay', stayOn(stays, '2026-12-17')?.name, 'Andaz');
    check('the checkout morning does not', stayOn(stays, '2026-12-19'), null);
}

console.log('\ntripCost() with lodging that spans:');
{
    const days = ['2026-12-16', '2026-12-17', '2026-12-18'].map((date, i) =>
        day({ id: `d${i}`, date }));
    const stays = [{ check_in: '2026-12-16', check_out: '2026-12-19', cost: 900, cost_shared: true }];
    const result = tripCost(days, {}, 3, stays);
    check('each night carries its share', result.days.map((d) => d.buckets.lodging), [100, 100, 100]);
    check('and the trip totals per person', result.perPerson, 300);
    check('with nothing double-counted', result.totals.lodging, 300);
}

console.log('\ndatesBetween() — the bug that made 36 days out of 15:');
{
    check('23 Dec to 6 Jan is fifteen days',
        datesBetween('2026-12-23', '2027-01-06').length, 15);
    check('  ending on the right day',
        datesBetween('2026-12-23', '2027-01-06').at(-1), '2027-01-06');
    // A date input reports every keystroke. Building a range from a half-typed
    // value created days that then had nowhere to go.
    check('a half-typed end date yields nothing', datesBetween('2026-12-23', '2027-01-0'), []);
    check('a half-typed start yields nothing', datesBetween('202', '2027-01-06'), []);
    check('an end before the start yields nothing',
        datesBetween('2027-01-06', '2026-12-23'), []);
    check('no end date means a single day',
        datesBetween('2026-12-23'), ['2026-12-23']);
}

console.log('\ndaysOfLeg() — a leg is inclusive, unlike a stay:');
check('16th to 19th is four days',
    daysOfLeg({ start_date: '2026-12-16', end_date: '2026-12-19' }),
    ['2026-12-16', '2026-12-17', '2026-12-18', '2026-12-19']);
// The distinction that matters: the same pair of dates means three nights in
// a hotel and four days in a city. Getting these the same way round would
// either lose the last day or charge a night too many.
check('  where the same dates are three nights',
    nightsOf({ check_in: '2026-12-16', check_out: '2026-12-19' }).length, 3);
check('a single day is one day', daysOfLeg({ start_date: '2026-12-16', end_date: '2026-12-16' }).length, 1);
check('backwards is nothing', daysOfLeg({ start_date: '2026-12-19', end_date: '2026-12-16' }), []);

console.log('\nlegOn():');
{
    const legs = [
        { id: 'g', city: 'Goa', start_date: '2026-12-23', end_date: '2026-12-27' },
        { id: 'k', city: 'Kerala', start_date: '2026-12-28', end_date: '2027-01-02' },
    ];
    check('a date inside a leg finds it', legOn(legs, '2026-12-25')?.city, 'Goa');
    check('the last day still counts', legOn(legs, '2026-12-27')?.city, 'Goa');
    check('across the boundary', legOn(legs, '2026-12-28')?.city, 'Kerala');
    check('a gap finds nothing', legOn(legs, '2027-01-05'), null);
}

console.log('\nrouteGaps() — what to fix before planning any single day:');
{
    const dates = ['2026-12-23', '2026-12-24', '2026-12-25', '2026-12-26'];
    const legs = [{ city: 'Goa', start_date: '2026-12-23', end_date: '2026-12-24' }];
    const stays = [{ check_in: '2026-12-23', check_out: '2026-12-24', cost: 100 }];
    const gaps = routeGaps(dates, legs, stays);
    check('days with no city are listed', gaps.unassigned, ['2026-12-25', '2026-12-26']);
    check('a night with a city but no bed is listed', gaps.unhoused, ['2026-12-24']);
    check('nothing overlaps', gaps.overlaps, []);
}
{
    const dates = ['2026-12-23', '2026-12-24'];
    const legs = [
        { city: 'Goa', start_date: '2026-12-23', end_date: '2026-12-24' },
        { city: 'Kerala', start_date: '2026-12-24', end_date: '2026-12-24' },
    ];
    check('two legs claiming a day is flagged',
        routeGaps(dates, legs, []).overlaps, ['2026-12-24']);
}
{
    // The final day of a trip is a travel day, not a night needing a bed.
    const dates = ['2026-12-23', '2026-12-24'];
    const legs = [{ city: 'Goa', start_date: '2026-12-23', end_date: '2026-12-24' }];
    const stays = [{ check_in: '2026-12-23', check_out: '2026-12-24', cost: 100 }];
    check('the last day is not counted as an unhoused night',
        routeGaps(dates, legs, stays).unhoused, []);
}

console.log('\nsummariseLegs():');
{
    const legs = [
        { id: 'k', city: 'Kerala', start_date: '2026-12-28', end_date: '2026-12-29' },
        { id: 'g', city: 'Goa', start_date: '2026-12-23', end_date: '2026-12-25' },
    ];
    const summary = summariseLegs(legs, {
        costsByDate: { '2026-12-23': 100, '2026-12-24': 50.5, '2026-12-25': 20 },
        itemsByDate: { '2026-12-23': [1, 2], '2026-12-24': [3] },
        weatherByDate: {
            '2026-12-23': { high: 88, low: 74 },
            '2026-12-24': { high: 90, low: 76 },
            '2026-12-25': { high: 86, low: 72 },
        },
        stays: [{ id: 's', check_in: '2026-12-23', check_out: '2026-12-25', cost: 400 }],
    });
    check('legs come out in date order', summary.map((s) => s.leg.city), ['Goa', 'Kerala']);
    check('three days is two nights', [summary[0].days, summary[0].nights], [3, 2]);
    check('the cost rolls up', summary[0].cost, 170.5);
    check('planned things are counted', summary[0].planned, 3);
    check('the weather averages', [summary[0].high, summary[0].low], [88, 74]);
    check('lodging touching the leg is attached', summary[0].lodging.length, 1);
    check('a leg with nothing in it is still a leg',
        [summary[1].days, summary[1].cost, summary[1].planned], [2, 0, 0]);
    check('no weather averages to null', summary[1].high, null);
}

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
