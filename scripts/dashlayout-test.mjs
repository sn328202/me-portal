import assert from 'node:assert/strict';
import {
    DEFAULT_SPANS, SPANS, spanOf, nextSpan, orderedWidgets, moveWidget,
} from '../src/utils/dashboardLayout.js';

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log(`  ok  ${name}`); };

console.log('how wide:');

t('a default per widget, and one for anything without', () => {
    assert.equal(spanOf('today'), 2);
    assert.equal(spanOf('travel'), 1);
    assert.equal(spanOf('library'), 3);
    assert.equal(spanOf('something-new'), 1);
});

t('but hers wins', () => {
    assert.equal(spanOf('travel', { travel: 3 }), 3);
    assert.equal(spanOf('library', { library: 1 }), 1);
});

t('a nonsense width falls back rather than breaking the grid', () => {
    // A 7 saved by some future version must not produce a seven-column card.
    assert.equal(spanOf('today', { today: 7 }), 2);
    assert.equal(spanOf('today', { today: 0 }), 2);
    assert.equal(spanOf('chores', { chores: 'wide' }), 1);
});

t('the control cycles rather than opening a menu', () => {
    assert.deepEqual(SPANS.map(nextSpan), [2, 3, 1]);
    assert.equal(nextSpan(99), 1);
});

console.log('\nin what order:');

const ENABLED = ['today', 'tobook', 'captures', 'chores', 'travel'];

t('hers, when she has one', () => {
    assert.deepEqual(
        orderedWidgets(ENABLED, ['travel', 'today', 'chores', 'captures', 'tobook']),
        ['travel', 'today', 'chores', 'captures', 'tobook']
    );
});

t('and the natural one when she has not', () => {
    assert.deepEqual(orderedWidgets(ENABLED, []), ENABLED);
    assert.deepEqual(orderedWidgets(ENABLED), ENABLED);
});

t('a widget that no longer exists is dropped, not drawn', () => {
    // A saved order outlives the widgets it names.
    assert.deepEqual(
        orderedWidgets(['today', 'travel'], ['pastimes', 'today', 'the-wire', 'travel']),
        ['today', 'travel']
    );
});

t('and a widget written since goes to the end, not the top', () => {
    // Visible without displacing what she arranged.
    assert.deepEqual(
        orderedWidgets(['today', 'travel', 'brandnew'], ['travel', 'today']),
        ['travel', 'today', 'brandnew']
    );
});

t('a duplicated id is drawn once', () => {
    assert.deepEqual(orderedWidgets(['today', 'travel'], ['today', 'today', 'travel']), ['today', 'travel']);
});

console.log('\nmoving one:');

const ORDER = ['a', 'b', 'c', 'd'];

t('down the list', () => {
    assert.deepEqual(moveWidget(ORDER, 'a', 'c'), ['b', 'c', 'a', 'd']);
});

t('and up it', () => {
    assert.deepEqual(moveWidget(ORDER, 'd', 'b'), ['a', 'd', 'b', 'c']);
});

t('onto itself, or onto nothing, changes nothing', () => {
    assert.deepEqual(moveWidget(ORDER, 'a', 'a'), ORDER);
    assert.deepEqual(moveWidget(ORDER, 'a', null), ORDER);
    assert.deepEqual(moveWidget(ORDER, 'a', 'zzz'), ORDER);
    assert.deepEqual(moveWidget(ORDER, 'zzz', 'a'), ORDER);
});

t('and it never moves the list it was given', () => {
    const before = [...ORDER];
    moveWidget(ORDER, 'a', 'd');
    assert.deepEqual(ORDER, before);
});

console.log(`\ndashboardLayout: ${n} passed`);
