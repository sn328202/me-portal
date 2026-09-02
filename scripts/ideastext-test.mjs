import assert from 'node:assert/strict';
import { ideasAsText, lineFor, linkFor, countable } from '../src/utils/ideasText.js';

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log(`  ok  ${name}`); };

const IDEAS = [
    { kind: 'eat', title: 'Rintaro', area: 'Mission', url: 'https://rintarosf.com', cost: 60 },
    { kind: 'eat', title: 'Tartine', area: 'Mission', place_id: 'PLACE1' },
    { kind: 'eat', title: 'Somewhere with no link at all' },
    { kind: 'do', title: 'Ferry Building', area: 'Embarcadero', place_id: 'PLACE2', cost: 0 },
    { kind: 'stay', title: 'The Line', cost: 240.5 },
    { kind: 'do', title: 'Already booked', url: 'https://x.com', promoted_at: '2026-08-01' },
    { kind: 'do', title: '   ' },
];

console.log('one idea, one line:');

t('the name, and the link under it', () => {
    assert.equal(lineFor(IDEAS[0]), '• Rintaro (Mission, $60)\n  https://rintarosf.com');
});

t('a place with no saved page gets a map link', () => {
    const line = lineFor(IDEAS[1]);
    assert.match(line, /^• Tartine \(Mission\)\n {2}https:\/\/www\.google\.com\/maps\/search/);
    assert.match(line, /query_place_id=PLACE1/);
});

t('and something with neither is just its name', () => {
    // "or just plain text if no link" — the whole reason this is not markdown.
    assert.equal(lineFor(IDEAS[2]), '• Somewhere with no link at all');
});

t('the saved page beats the map', () => {
    // A menu she kept is worth opening; a map link can be got from the name.
    assert.equal(linkFor({ url: 'https://menu.example', place_id: 'P' }), 'https://menu.example');
    assert.equal(linkFor({ place_id: 'P', title: 'X' }).includes('query_place_id=P'), true);
    assert.equal(linkFor({ title: 'X' }), '');
    assert.equal(linkFor(null), '');
});

t('a cost of nothing is not a cost', () => {
    assert.equal(lineFor(IDEAS[3]).startsWith('• Ferry Building (Embarcadero)'), true);
});

t('and a cost with pennies keeps them', () => {
    assert.equal(lineFor(IDEAS[4]), '• The Line ($240.50)');
});

t('an unnamed idea makes no line', () => {
    assert.equal(lineFor({ title: '   ' }), '');
    assert.equal(lineFor(undefined), '');
});

console.log('\nthe whole board:');

const text = ideasAsText(IDEAS, { tripName: 'Resh + Chels in SF!' });

t('headed, and grouped into its three piles', () => {
    assert.match(text, /^Resh \+ Chels in SF! — ideas\n\n/);
    assert.match(text, /Things to do\n/);
    assert.match(text, /Places to eat\n/);
    assert.match(text, /Places to stay\n/);
});

t('in the order the board reads, not the order they were added', () => {
    const order = ['Things to do', 'Places to eat', 'Places to stay']
        .map((h) => text.indexOf(h));
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

t('what is already on a day is not an option any more', () => {
    // Sending it back as a choice asks a question that has been answered.
    assert.equal(text.includes('Already booked'), false);
});

t('an empty pile is left out, not printed empty', () => {
    const onlyFood = ideasAsText([{ kind: 'eat', title: 'One place' }]);
    assert.equal(onlyFood.includes('Things to do'), false);
    assert.equal(onlyFood.includes('Places to stay'), false);
    assert.match(onlyFood, /Places to eat\n• One place/);
});

t('nothing to send is empty, so a button can say so', () => {
    assert.equal(ideasAsText([]), '');
    assert.equal(ideasAsText(), '');
    assert.equal(ideasAsText([{ kind: 'do', title: 'x', promoted_at: '2026-01-01' }]), '');
});

t('no trip name still gets a heading', () => {
    assert.match(ideasAsText([{ kind: 'do', title: 'A thing' }]), /^Ideas\n\n/);
});

t('it is plain text — no markdown anyone has to render', () => {
    // It goes into WhatsApp, a text message, an email. A bare URL is the one
    // thing all of them turn into something tappable.
    assert.equal(/\[.*\]\(.*\)/.test(text), false, 'no markdown links');
    assert.equal(text.includes('**'), false, 'no bold');
    assert.equal(text.includes('<'), false, 'no html');
});

t('and it counts what it would send', () => {
    assert.equal(countable(IDEAS), 5, 'seven, less one promoted and one unnamed');
    assert.equal(countable([]), 0);
});

console.log(`\nideasText: ${n} passed`);
