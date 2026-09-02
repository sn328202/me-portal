import assert from 'node:assert/strict';
import {
    PROMPTS, MEDIA, boardFor, tally, yearFor, promptById, thisYear,
} from '../src/utils/picks.js';

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log(`  ok  ${name}`); };

console.log('the questions:');

t('every prompt has a title and a hint for every medium', () => {
    // A prompt that reads as a form gets a form's answer, so each one is
    // worded per medium. This is the check that none was forgotten.
    for (const media of MEDIA) {
        for (const p of PROMPTS) {
            const title = p.title(media, 2026);
            const hint = p.hint(media, 2026);
            assert.ok(title && title.length > 2, `${p.id} has no title for ${media}`);
            assert.ok(hint && hint.length > 2, `${p.id} has no hint for ${media}`);
            assert.ok(!/undefined/.test(`${title} ${hint}`), `${p.id} leaks undefined for ${media}`);
        }
    }
});

t('the verb follows the medium', () => {
    const doing = (m) => PROMPTS.find((p) => p.id === 'currently').title(m, 2026);
    assert.equal(doing('Book'), 'Reading now');
    assert.equal(doing('Album'), 'Listening to now');
    assert.equal(doing('Game'), 'Playing now');

    const again = (m) => PROMPTS.find((p) => p.id === 'comfort').title(m, 2026);
    assert.equal(again('Book'), 'Comfort reread');
    assert.equal(again('Movie'), 'Comfort rewatch');
    // An album is not rewatched. It is on.
    assert.equal(again('Album'), 'Always on');
});

t('the gateway prompt names the right kind of person', () => {
    const gateway = PROMPTS.find((p) => p.id === 'gateway');
    assert.match(gateway.hint('Book', 2026), /reader/);
    assert.match(gateway.hint('Game', 2026), /player/);
});

t('the yearly one says which year', () => {
    assert.equal(promptById('best_of').title('Movie', 2026), 'Best of 2026');
    assert.equal(promptById('best_of').title('Movie', 2031), 'Best of 2031');
});

t('the four favourites come first and the yearly one last', () => {
    assert.equal(PROMPTS[0].id, 'top_four', 'hardest and most revealing, so first');
    assert.equal(PROMPTS[PROMPTS.length - 1].id, 'best_of', 'blank every January, so last');
});

console.log('\nwhich year a row belongs to:');

t('only the yearly prompt carries a year', () => {
    assert.equal(yearFor('best_of', 2026), 2026);
    assert.equal(yearFor('top_four', 2026), 0);
    assert.equal(yearFor('comfort', 2026), 0);
});

t('and an unknown prompt is not yearly', () => {
    assert.equal(yearFor('nonsense', 2026), 0);
    assert.equal(promptById('nonsense'), null);
});

t('this year comes off the wall clock, not UTC', () => {
    // 8pm on New Year's Eve in California is already next year in UTC.
    assert.equal(thisYear(new Date(2026, 11, 31, 20, 0, 0)), 2026);
});

console.log('\nlaying the page out:');

const PICKS = [
    { media: 'Movie', slot: 'top_four', position: 0, year: 0, title: 'Aftersun' },
    { media: 'Movie', slot: 'top_four', position: 2, year: 0, title: 'Paddington 2' },
    { media: 'Movie', slot: 'comfort', position: 0, year: 0, title: 'Nora' },
    { media: 'Movie', slot: 'best_of', position: 0, year: 2026, title: 'The Odyssey' },
    { media: 'Movie', slot: 'best_of', position: 0, year: 2025, title: 'Last year\'s' },
    { media: 'Book', slot: 'top_four', position: 0, year: 0, title: 'Piranesi' },
];

t('an empty blank is still a blank, not a missing row', () => {
    // The unanswered questions are the point. A page that showed only the
    // answers would give her nowhere to put the next one.
    const board = boardFor(PICKS, 'Movie', 2026);
    const top = board.find((r) => r.id === 'top_four');
    assert.equal(top.slots.length, 4);
    assert.deepEqual(top.slots.map((s) => s && s.title),
        ['Aftersun', null, 'Paddington 2', null]);
});

t('a pick sits in the position it was given', () => {
    const top = boardFor(PICKS, 'Movie').find((r) => r.id === 'top_four');
    assert.equal(top.slots[2].title, 'Paddington 2', 'not shuffled up into the gap');
});

t('another medium\'s picks stay out of it', () => {
    const top = boardFor(PICKS, 'Movie').find((r) => r.id === 'top_four');
    assert.equal(top.slots.some((s) => s && s.title === 'Piranesi'), false);
});

t('the yearly prompt shows the year being asked about', () => {
    assert.equal(boardFor(PICKS, 'Movie', 2026).find((r) => r.id === 'best_of').slots[0].title,
        'The Odyssey');
    assert.equal(boardFor(PICKS, 'Movie', 2025).find((r) => r.id === 'best_of').slots[0].title,
        "Last year's");
    assert.equal(boardFor(PICKS, 'Movie', 2027).find((r) => r.id === 'best_of').slots[0], null,
        'a year she has not answered yet is blank, not last year\'s');
});

t('nothing at all lays out as every blank, empty', () => {
    const board = boardFor([], 'Album');
    assert.equal(board.length, PROMPTS.length);
    assert.equal(board.every((r) => r.slots.every((s) => s === null)), true);
    assert.deepEqual(boardFor(undefined, 'Album').length, PROMPTS.length);
});

console.log('\nhow far through she is:');

t('counted over the questions with answers', () => {
    const { filled, of } = tally(PICKS, 'Movie', 2026);
    assert.equal(filled, 4, 'two favourites, a comfort watch and this year');
    // 4 + 1 + 1 + 1 + 1 + 1 = 9. "Right now" is deliberately not counted.
    assert.equal(of, 9);
});

t('being between things is not an unanswered question', () => {
    // "Right now" empty means she is between books, which is a real state.
    const withCurrent = [...PICKS, { media: 'Movie', slot: 'currently', position: 0, year: 0, title: 'X' }];
    assert.equal(tally(withCurrent, 'Movie', 2026).of, 9, 'the total does not move');
    assert.equal(tally(withCurrent, 'Movie', 2026).filled, 5, 'but it still counts as filled in');
});

t('an untouched medium is nought of nine', () => {
    assert.deepEqual(tally([], 'Game'), { filled: 0, of: 9 });
});

console.log(`\npicks: ${n} passed`);
