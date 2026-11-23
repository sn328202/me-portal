/**
 * The Circle: birthdays, "last in touch", the catch-up order and how two
 * people read from each end. Pinned to a zone far from hers so anything that
 * slips through a local Date shows up as a wrong answer.
 */

process.env.TZ = 'Pacific/Kiritimati';

const {
    nextBirthday, birthdayLabel, inDaysLabel, sinceLabel, lastTouchByPerson,
    upcomingBirthdays, birthdaysByMonth, catchUpList, reverseOf, linksFor, linksWithin,
    splitList, initials, personFromForm, formFromPerson, matchesSearch,
} = await import('../src/utils/people.js');

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

const today = '2026-11-07';
const p = (name, m, d, extra = {}) => ({ id: name, name, birthday_month: m, birthday_day: d, ...extra });

console.log('birthdays');
check('today is today', nextBirthday(p('Reshma', 11, 7), today), { date: '2026-11-07', days: 0, turning: null });
check('tomorrow', nextBirthday(p('Steven', 11, 8), today).days, 1);
check('already passed rolls to next year', nextBirthday(p('Zahid', 9, 10), today).date, '2027-09-10');
check('new year wraps', nextBirthday(p('Esha', 1, 1), today).days, 55);
check('turning, when the year is known', nextBirthday(p('Pushkar', 12, 6, { birth_year: 1965 }), today).turning, 61);
check('leap day in a common year is the 28th', nextBirthday(p('Leap', 2, 29), '2026-11-07').date, '2027-02-28');
check('leap day in a leap year is the 29th', nextBirthday(p('Leap', 2, 29), '2027-11-07').date, '2028-02-29');
check('no birthday', nextBirthday({ name: 'x' }, today), null);
check('label', birthdayLabel(p('a', 12, 6)), 'Dec 6');
check('label with year', birthdayLabel(p('a', 12, 6, { birth_year: 1965 })), 'Dec 6, 1965');
check('in days', [0, 1, 7, 21, 120].map(inDaysLabel), ['today', 'tomorrow', 'in 7 days', 'in 3 weeks', 'in 4 months']);

const people = [p('Reshma', 11, 7), p('Steven', 11, 8), p('Solji', 11, 14), p('Pushkar', 12, 6), p('Zahid', 9, 10), { id: 'A', name: 'Adeesh' }];
check('upcoming within 30, soonest first',
    upcomingBirthdays(people, today, 30).map((x) => x.person.name), ['Reshma', 'Steven', 'Solji', 'Pushkar']);
const months = birthdaysByMonth(people, today);
check('months start with this one', months[0].name, 'November');
check('november in day order', months[0].people.map((x) => x.name), ['Reshma', 'Steven', 'Solji']);
check('september is last but one', months[10].people.map((x) => x.name), ['Zahid']);

console.log('in touch');
check('since', ['2026-11-07', '2026-11-06', '2026-11-01', '2026-10-10', '2026-05-01', '2025-09-01', '2023-01-01', null]
    .map((d) => sinceLabel(d, today)),
['today', 'yesterday', '6 days ago', '4 weeks ago', '6 months ago', 'over a year ago', '3 years ago', 'never logged']);
const touches = [
    { person_id: 'Reshma', happened_on: '2026-10-01', created_at: 'a' },
    { person_id: 'Reshma', happened_on: '2026-11-01', created_at: 'a' },
    { person_id: 'Solji', happened_on: '2026-06-01', created_at: 'a' },
    { person_id: 'Steven', happened_on: '2026-11-05', created_at: 'a' },
];
const last = lastTouchByPerson(touches);
check('latest wins', last.get('Reshma').happened_on, '2026-11-01');

const circle = [
    p('Reshma', 11, 7, { touch_every_days: 30 }),      // 6 days ago, fine
    p('Solji', 11, 14, { touch_every_days: 30 }),      // 159 days ago, overdue 129
    p('Steven', 11, 8, { touch_every_days: 1 }),       // 2 days ago, overdue 1
    p('Pushkar', 12, 6),                               // never
    p('Zahid', 9, 10, { touch_every_days: 90 }),       // never, overdue by its gap
];
check('catch-up order',
    catchUpList(circle, last, today).map((r) => r.person.name),
    ['Solji', 'Zahid', 'Steven', 'Reshma', 'Pushkar']);

console.log('relationships');
check('husband reads back as partner', reverseOf('Husband'), 'partner');
check('mom reads back as child', reverseOf('mom'), 'child');
check('friend is the same both ways', reverseOf('friend'), null);
const byId = new Map(circle.map((x) => [x.id, x]));
const links = [
    { id: 'l1', person_a: 'Reshma', person_b: 'Solji', label: 'sister', reverse_label: 'sibling' },
    { id: 'l2', person_a: 'Steven', person_b: 'Reshma', label: 'friend', reverse_label: null },
];
check('from a, what b is to a', linksFor('Reshma', links, byId).map((x) => `${x.other.name}:${x.label}`), ['Solji:sister', 'Steven:friend']);
check('from b, the reverse', linksFor('Solji', links, byId).map((x) => `${x.other.name}:${x.label}`), ['Reshma:sibling']);
check('within a group', linksWithin(['Reshma', 'Solji'], links).map((l) => l.id), ['l1']);

console.log('form');
check('split list dedupes', splitList('jazz, Ramen; ramen\nthe Warriors, '), ['jazz', 'Ramen', 'the Warriors']);
check('initials', [initials('Jesse Peralta II'), initials('sallyk_13'), initials('')], ['JP', 'S1', '?']);
const row = personFromForm({ ...formFromPerson({}), name: ' Riya ', birthday_month: '12', birthday_day: '19', birth_year: '', touch_every_days: '30' });
check('row', [row.name, row.birthday_month, row.birthday_day, row.birth_year, row.touch_every_days, row.phone], ['Riya', 12, 19, null, 30, null]);
check('half a birthday is none', personFromForm({ name: 'x', birthday_month: '3', birthday_day: '' }).birthday_month, null);
check('year without a day is dropped', personFromForm({ name: 'x', birth_year: '1990' }).birth_year, null);
check('search finds likes', matchesSearch({ name: 'A', likes: ['Matcha'] }, 'matcha'), true);

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall people checks pass');
