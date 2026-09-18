import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
    readDate, readClock, clockLabel, minutesBefore, daysBetween,
    normaliseSteps, sortSteps, dayLabel, groupByDay, planLoad, lengthLabel,
    stampPlan, replanFor, offsetFrom,
} from '../api/_cookPlan.js';

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log(`  ok   ${name}`); };

console.log('reading what she typed:');

t('a date is a date', () => {
    assert.deepEqual(readDate('2026-09-26'), { y: 2026, m: 9, d: 26 });
    assert.equal(readDate('26/09/2026'), null);
    assert.equal(readDate(''), null);
});

t('and a day that never happened is not one', () => {
    // 31 February would otherwise roll quietly forward to 3 March, and the
    // whole plan would hang off a day that is not the day.
    assert.equal(readDate('2026-02-31'), null);
    assert.equal(readDate('2026-13-01'), null);
    assert.deepEqual(readDate('2028-02-29'), { y: 2028, m: 2, d: 29 }, 'but a leap day did happen');
    assert.equal(readDate('2026-02-29'), null);
});

t('a clock can be said several ways', () => {
    assert.equal(readClock('20:00'), 1200);
    assert.equal(readClock('8:00 pm'), 1200);
    assert.equal(readClock('8pm'), 1200);
    assert.equal(readClock('12am'), 0);
    assert.equal(readClock('12pm'), 720);
    assert.equal(readClock('00:30'), 30);
});

t('and some things are not a clock', () => {
    assert.equal(readClock('25:00'), null);
    assert.equal(readClock('8:75'), null);
    assert.equal(readClock('13pm'), null);
    assert.equal(readClock('dinner'), null);
});

t('it says a time back the way a kitchen says it', () => {
    assert.equal(clockLabel('06:00'), '6:00 am');
    assert.equal(clockLabel('20:30'), '8:30 pm');
    assert.equal(clockLabel('00:15'), '12:15 am');
    assert.equal(clockLabel('12:00'), '12:00 pm');
});

console.log('\ncounting backwards from dinner:');

t('an hour before dinner is an hour before dinner', () => {
    assert.deepEqual(minutesBefore('2026-09-26', '20:00', 60), { date: '2026-09-26', time: '19:00' });
});

t('and fourteen hours before is the morning of', () => {
    assert.deepEqual(minutesBefore('2026-09-26', '20:00', 14 * 60), { date: '2026-09-26', time: '06:00' });
});

t('and an overnight soak starts the day before', () => {
    // The one the whole module exists for: 26 hours before Saturday 8pm is
    // Friday at 6pm, and a model asked to do this in its head says Saturday.
    assert.deepEqual(minutesBefore('2026-09-26', '20:00', 26 * 60), { date: '2026-09-25', time: '18:00' });
});

t('midnight is not a special case', () => {
    assert.deepEqual(minutesBefore('2026-09-26', '00:30', 60), { date: '2026-09-25', time: '23:30' });
    assert.deepEqual(minutesBefore('2026-09-26', '20:00', 20 * 60), { date: '2026-09-26', time: '00:00' });
});

t('nor is the end of a year', () => {
    assert.deepEqual(minutesBefore('2027-01-01', '00:30', 60), { date: '2026-12-31', time: '23:30' });
});

t('nor a leap day', () => {
    assert.deepEqual(minutesBefore('2028-03-01', '08:00', 24 * 60), { date: '2028-02-29', time: '08:00' });
    assert.deepEqual(minutesBefore('2027-03-01', '08:00', 24 * 60), { date: '2027-02-28', time: '08:00' });
});

t('three days ahead is three days ahead', () => {
    assert.deepEqual(minutesBefore('2026-09-26', '20:00', 3 * 24 * 60), { date: '2026-09-23', time: '20:00' });
    assert.equal(daysBetween('2026-09-23', '2026-09-26'), 3);
    assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
    assert.equal(daysBetween('nonsense', '2027-01-01'), null);
});

t('and none of it depends on where she is', () => {
    /* A wall clock put through a Date comes back as whatever instant the
       machine thought it was, which is the bug the travel tables were rebuilt
       to stop making. Four real processes, because Node reads TZ once at
       startup and a loop that reassigns process.env.TZ proves nothing. */
    const probe = `
        import { minutesBefore } from './api/_cookPlan.js';
        process.stdout.write(JSON.stringify([
            minutesBefore('2026-09-26', '20:00', 26 * 60),
            minutesBefore('2026-03-08', '02:30', 60),
            minutesBefore('2027-01-01', '00:30', 60),
        ]));
    `;
    const zones = ['UTC', 'America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Kiritimati'];
    const answers = zones.map((TZ) => execFileSync(
        process.execPath,
        ['--input-type=module', '-e', probe],
        { env: { ...process.env, TZ }, encoding: 'utf8' }
    ));
    assert.equal(new Set(answers).size, 1, `four timezones, four answers: ${answers.join(' | ')}`);
    assert.match(answers[0], /2026-09-25/);
});

t('and a clock she typed comes back as a distance from dinner', () => {
    // She drags "take the lamb out" to 6pm; the plan has to know that is two
    // hours before, so it still holds when dinner moves.
    const serve = { serve_date: '2026-09-26', serve_time: '20:00' };
    assert.equal(offsetFrom(serve, { date: '2026-09-26', time: '18:00' }), 120);
    assert.equal(offsetFrom(serve, { date: '2026-09-25', time: '18:00' }), 26 * 60);
    assert.equal(offsetFrom(serve, { date: '2026-09-26', time: '20:00' }), 0);
    assert.equal(offsetFrom(serve, { date: 'later', time: '18:00' }), null);
    assert.equal(offsetFrom({}, { date: '2026-09-26', time: '18:00' }), null);
});

console.log('\nturning what the model said into a plan:');

const SERVE = { serve_date: '2026-09-26', serve_time: '20:00' };
const RAW = [
    { what: 'Take the lamb out of the fridge', dish: 'Lamb', starts_before_serve: 90, minutes: 2 },
    { what: 'Soak the chana overnight', dish: 'Chana', starts_before_serve: 26 * 60, minutes: 5, waiting: true },
    { what: '   ', dish: 'Nothing', starts_before_serve: 30 },
    { what: 'Rest the dough', dish: 'Bread', starts_before_serve: 26 * 60, minutes: 60, waiting: true },
];

t('every step lands on a real clock', () => {
    const steps = normaliseSteps(RAW, SERVE);
    const soak = steps.find((s) => s.what.startsWith('Soak'));
    assert.equal(soak.at_date, '2026-09-25');
    assert.equal(soak.at_time, '18:00');
});

t('the earliest thing is first, because it is the easiest to miss', () => {
    const steps = normaliseSteps(RAW, SERVE);
    assert.equal(steps[0].at_date, '2026-09-25');
    assert.equal(steps.at(-1).what, 'Take the lamb out of the fridge');
    assert.deepEqual(steps.map((s) => s.id), ['s1', 's2', 's3']);
});

t('a step that does not say what to do is not a step', () => {
    assert.equal(normaliseSteps(RAW, SERVE).some((s) => s.dish === 'Nothing'), false);
});

t('nothing is planned against a serve time it cannot read', () => {
    assert.deepEqual(normaliseSteps(RAW, { serve_date: 'saturday', serve_time: '8ish' }), []);
    assert.deepEqual(normaliseSteps(RAW, {}), []);
    assert.deepEqual(normaliseSteps(null, SERVE), []);
});

t('a step from next month is clamped to a week, not believed', () => {
    const [step] = normaliseSteps([{ what: 'Ferment', starts_before_serve: 99999999 }], SERVE);
    assert.equal(step.starts_before_serve, 7 * 24 * 60);
    assert.equal(step.at_date, '2026-09-19');
});

t('and a negative one is now, not after dinner', () => {
    const [step] = normaliseSteps([{ what: 'Serve', starts_before_serve: -60 }], SERVE);
    assert.equal(step.starts_before_serve, 0);
    assert.equal(step.at_time, '20:00');
});

t('waiting is not working', () => {
    // Eight hours of soaking counted as eight hours of cooking reads as an
    // impossible day and makes the whole plan untrustworthy.
    const steps = normaliseSteps(RAW, SERVE);
    const load = planLoad(steps);
    assert.equal(load.handsOn, 2, 'only the two minutes of actual work');
    assert.equal(load.steps, 3);
    assert.deepEqual(load.starts, { date: '2026-09-25', time: '18:00' });
});

t('and it counts what is already ticked off', () => {
    const steps = normaliseSteps(RAW, SERVE).map((s, i) => ({ ...s, done: i === 0 }));
    assert.equal(planLoad(steps).done, 1);
    assert.deepEqual(planLoad([]), { steps: 0, starts: null, handsOn: 0, done: 0 });
});

console.log('\nread as days, because that is how it gets done:');

t('the days are named the way a cook names them', () => {
    assert.equal(dayLabel('2026-09-26', '2026-09-26'), 'On the day');
    assert.equal(dayLabel('2026-09-25', '2026-09-26'), 'The day before');
    assert.equal(dayLabel('2026-09-24', '2026-09-26'), 'Two days before');
    assert.equal(dayLabel('2026-09-23', '2026-09-26'), 'Three days before');
    assert.equal(dayLabel('2026-09-20', '2026-09-26'), '6 days before');
});

t('and the plan comes back in them', () => {
    const days = groupByDay(normaliseSteps(RAW, SERVE), SERVE.serve_date);
    assert.deepEqual(days.map((d) => d.label), ['The day before', 'On the day']);
    assert.equal(days[0].steps.length, 2);
    assert.equal(days[1].steps.length, 1);
});

t('a length of time reads like one', () => {
    assert.equal(lengthLabel(0), '');
    assert.equal(lengthLabel(45), '45 min');
    assert.equal(lengthLabel(60), '1 hr');
    assert.equal(lengthLabel(80), '1 hr 20 min');
});

console.log('\nwhen dinner moves:');

t('every step keeps its distance from the food going out', () => {
    // Saturday 8pm becomes Saturday 7pm. Nothing is asked of the model again,
    // and nothing she has already read is quietly rewritten.
    const plan = stampPlan({ ...SERVE, steps: normaliseSteps(RAW, SERVE), note: 'Two things happen the night before.' });
    const moved = replanFor(plan, { serve_date: '2026-09-26', serve_time: '19:00' });
    assert.equal(moved.serve_time, '19:00');
    assert.deepEqual(
        moved.steps.map((s) => s.starts_before_serve),
        plan.steps.map((s) => s.starts_before_serve),
        'the distances are untouched'
    );
    assert.equal(moved.steps[0].at_time, '17:00', 'and every clock moved with it');
    assert.equal(moved.steps[0].at_date, '2026-09-25');
    assert.equal(moved.note, plan.note);
});

t('moving it to a time that is not a time changes nothing', () => {
    const plan = stampPlan({ ...SERVE, steps: normaliseSteps(RAW, SERVE) });
    assert.deepEqual(replanFor(plan, { serve_date: '2026-09-26', serve_time: 'eightish' }), plan);
    assert.equal(replanFor(null, SERVE), null);
});

t('and ticked steps stay ticked through the move', () => {
    const steps = normaliseSteps(RAW, SERVE).map((s) => ({ ...s, done: true }));
    const moved = replanFor(stampPlan({ ...SERVE, steps }), { serve_date: '2026-09-27', serve_time: '13:00' });
    assert.ok(moved.steps.every((s) => s.done));
    // Two overnight jobs the day before, one on the day itself.
    assert.deepEqual(sortSteps(moved.steps).map((s) => s.at_date), ['2026-09-26', '2026-09-26', '2026-09-27']);
});

console.log('\nwhat the model is shown, and what comes back:');

const { dishBrief, matchDish } = await import('../api/cook-plan.js');

const ENTRIES = [
    { course_name: 'Main Course', recipe_id: 'r1', recipes: { id: 'r1', title: 'Chana Masala', prep_time: '20 min', cook_time: '45 min', servings: '4', instructions: 'Soak the chana overnight.\nCook it.', ingredients: [{ item: 'chana', amount: '2', unit: 'cups' }] } },
    { course_name: 'Potable', recipe_id: null, item_name: 'Diet Coke', item_note: '2 bottles' },
];

t('a recipe is written out with its method, because that is where the soak is', () => {
    const brief = dishBrief(ENTRIES[0]);
    assert.match(brief, /Chana Masala/);
    assert.match(brief, /Soak the chana overnight/);
    assert.match(brief, /prep 20 min/);
    assert.match(brief, /2 cups chana/);
});

t('and something bought says so, so it is not given a method it does not have', () => {
    const brief = dishBrief(ENTRIES[1]);
    assert.match(brief, /Diet Coke/);
    assert.match(brief, /bought, not cooked/);
    assert.match(brief, /2 bottles/);
    assert.equal(brief.includes('Method'), false);
});

t('a step finds its way back to the recipe it belongs to', () => {
    assert.equal(matchDish('Chana Masala', ENTRIES), 'r1');
    assert.equal(matchDish('chana masala', ENTRIES), 'r1');
    assert.equal(matchDish('The Chana Masala', ENTRIES), 'r1');
});

t('and a step about everything belongs to nothing in particular', () => {
    assert.equal(matchDish('Everything', ENTRIES), null);
    assert.equal(matchDish('', ENTRIES), null);
    assert.equal(matchDish('Diet Coke', ENTRIES), null, 'a bought thing has no recipe to point at');
});

console.log(`\ncookPlan: ${n} passed`);
