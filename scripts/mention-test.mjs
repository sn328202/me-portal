/**
 * The @-mention's arithmetic.
 *
 * Every case here is one character wide, which is exactly why it is a test
 * and not a look: a replacement that is off by one eats the space in front of
 * the word it replaced, and you only notice three plans later.
 */

import { mentionAt, replaceMention, placeSubtitle } from '../src/utils/mention.js';

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

console.log('\nfinding the mention under the caret:');
check('a bare mention', mentionAt('@masque', 7), { start: 0, end: 7, query: 'masque' });
check('one at the end of a sentence', mentionAt('dinner at @masque', 17), {
    start: 10, end: 17, query: 'masque',
});
check('an empty one, the moment @ is typed', mentionAt('dinner at @', 11), {
    start: 10, end: 11, query: '',
});
check('a mention can hold two words', mentionAt('@marine drive', 13), {
    start: 0, end: 13, query: 'marine drive',
});
check('no @ is no mention', mentionAt('dinner at masque', 16), null);
check(
    'an email address is not a mention',
    mentionAt('mail neha@example.com', 21),
    null
);
check(
    'the caret before the @ sees nothing',
    mentionAt('dinner at @masque', 5),
    null
);
check('only up to the caret counts', mentionAt('@masque tonight', 4), {
    start: 0, end: 4, query: 'mas',
});
check('a second @ starts a new mention', mentionAt('@a @b', 5), { start: 3, end: 5, query: 'b' });
check(
    'a whole sentence after a stray @ is not a query',
    mentionAt(`@${'x'.repeat(60)}`, 61),
    null
);
check('a line break ends it', mentionAt('@masque\nand then', 16), null);

console.log('\nputting the chosen name in:');
check('it replaces exactly the mention', replaceMention('dinner at @masq', {
    start: 10, end: 15, query: 'masq',
}, 'Masque'), { text: 'dinner at Masque ', caret: 17 });
check('the words after it survive', replaceMention('at @masq tonight', {
    start: 3, end: 8, query: 'masq',
}, 'Masque'), { text: 'at Masque tonight', caret: 10 });
check('and are not given a second space', replaceMention('@a b', {
    start: 0, end: 2, query: 'a',
}, 'Aa').text, 'Aa b');
check('a name with spaces goes in whole', replaceMention('@m', {
    start: 0, end: 2, query: 'm',
}, 'Marine Drive').text, 'Marine Drive ');
check('no token, no change', replaceMention('plain', null, 'Masque'), {
    text: 'plain', caret: 5,
});

console.log('\nwhat the menu says underneath:');
check(
    'the street and the city, not the postcode',
    placeSubtitle({ address: 'G Block, Bandra Kurla Complex, Mumbai, Maharashtra 400051, India' }),
    'G Block, Bandra Kurla Complex'
);
check('an address of one part is that part', placeSubtitle({ address: 'Mumbai' }), 'Mumbai');
check('no address falls back to the category', placeSubtitle({ category: 'restaurant' }), 'restaurant');
check('and to nothing at all', placeSubtitle({}), '');

console.log(failed ? `\n${failed} failing` : '\nall passing');
process.exit(failed ? 1 : 0);
