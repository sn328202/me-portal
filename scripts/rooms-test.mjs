import assert from 'node:assert/strict';
import { roomKey, tidyRoom, groupByRoom, roomsFrom, pickRoom, MISC } from '../src/utils/rooms.js';

let n = 0;
const it = (name, fn) => { fn(); n += 1; };

it('agrees on a name across spellings', () => {
    assert.equal(roomKey('Living Room'), 'living room');
    assert.equal(roomKey('living  room'), 'living room');
    assert.equal(roomKey('  LIVING ROOM '), 'living room');
});

it('tidies for storing, and blank means Misc', () => {
    assert.equal(tidyRoom('guest  bathroom'), 'Guest Bathroom');
    assert.equal(tidyRoom('  '), MISC);
    assert.equal(tidyRoom(null), MISC);
});

/* The rooms actually in her data, four of which had no tab. */
const chores = [
    { id: 1, room: 'Guest Room', completed: false },
    { id: 2, room: 'Guest Room', completed: false },
    { id: 3, room: 'Kitchen', completed: false },
    { id: 4, room: 'Laundry Room', completed: true },
    { id: 5, room: 'living room', completed: false },
    { id: 6, room: 'Living Room', completed: false },
    { id: 7, room: '', completed: false },
    { id: 8, room: null, completed: false },
];

it('makes a room out of anything a chore was filed under', () => {
    const rooms = roomsFrom(chores);
    assert.deepEqual(rooms.map((r) => r.name),
        ['Guest Room', 'Kitchen', 'Laundry Room', 'living room', MISC]);
});

it('does not split a room over its capitals', () => {
    const rooms = roomsFrom(chores);
    const living = rooms.find((r) => r.key === 'living room');
    assert.equal(living.total, 2, 'both spellings, one room');
});

it('never loses a chore with no room', () => {
    const rooms = roomsFrom(chores);
    const misc = rooms.find((r) => r.name === MISC);
    assert.equal(misc.total, 2);
    const seen = rooms.reduce((sum, r) => sum + r.total, 0);
    assert.equal(seen, chores.length, 'every chore has a tab');
});

it('puts Misc last, whatever it is called alphabetically', () => {
    assert.equal(roomsFrom(chores).at(-1).name, MISC);
    assert.equal(roomsFrom([{ room: 'Attic' }, { room: '' }]).at(-1).name, MISC);
});

it('counts what is still to do', () => {
    const rooms = roomsFrom(chores);
    assert.equal(rooms.find((r) => r.name === 'Guest Room').open, 2);
    assert.equal(rooms.find((r) => r.name === 'Laundry Room').open, 0);
    assert.equal(rooms.find((r) => r.name === 'Laundry Room').total, 1);
});

it('suggests five only when there is nothing at all', () => {
    assert.equal(roomsFrom([]).length, 5);
    assert.equal(roomsFrom([{ room: 'Attic' }]).length, 1, 'her one room, not hers plus five');
});

it('keeps a room she made before she filed anything in it', () => {
    const rooms = roomsFrom([{ room: 'Attic' }], ['Balcony']);
    assert.deepEqual(rooms.map((r) => r.name), ['Attic', 'Balcony']);
    assert.equal(rooms.find((r) => r.name === 'Balcony').total, 0);
});

it('does not duplicate a made room once something lands in it', () => {
    const rooms = roomsFrom([{ room: 'balcony' }], ['Balcony']);
    assert.equal(rooms.length, 1);
});

/* --- which tab to be on ---------------------------------------------- */

it('stays where she is', () => {
    const rooms = roomsFrom(chores);
    assert.equal(pickRoom(rooms, 'Kitchen'), 'kitchen');
    assert.equal(pickRoom(rooms, 'KITCHEN'), 'kitchen');
});

it('moves off a room that has gone', () => {
    const rooms = roomsFrom(chores);
    assert.equal(pickRoom(rooms, 'Observatory'), 'guest room', 'first with something open');
});

it('lands somewhere even when everything is done', () => {
    const rooms = roomsFrom([{ room: 'Attic', completed: true }]);
    assert.equal(pickRoom(rooms, ''), 'attic');
    assert.equal(pickRoom([], ''), '');
});

console.log(`rooms: ${n} passed`);

/* --- and the same question on the way in ------------------------------ */
{
    const { matchRoom } = await import('../api/capture.js');
    const rooms = ['Guest Room', 'Kitchen', 'Living Room', 'Guest Bathroom', 'Laundry Room', 'Main Bedroom'];
    let m = 0;
    const t = (asked, want) => { assert.equal(matchRoom(asked, rooms), want, JSON.stringify(asked)); m += 1; };

    // Joins a room already in use rather than starting one beside it.
    t('the guest bath', 'Guest Bathroom');
    t('guest bathroom', 'Guest Bathroom');
    t('the living room', 'Living Room');
    t('my kitchen', 'Kitchen');
    t('guest', 'Guest Room');
    t('guest rooms', 'Guest Room');
    t('laundry', 'Laundry Room');

    // A room she has not used yet is a room, tidied, article dropped.
    t('garage', 'Garage');
    t('the balcony', 'Balcony');
    t('kids playroom', 'Kids Playroom');
    assert.equal(matchRoom('Garage', []), 'Garage');

    // Nothing usable goes somewhere she will find it, never nowhere.
    t('', 'Misc');
    t(null, 'Misc');
    t(undefined, 'Misc');
    t('   ', 'Misc');
    t('the room', 'Misc');

    console.log(`matchRoom: ${m + 1} passed`);
}

/* --- one scrollable board --------------------------------------------- */
{
    const { board } = await import('../src/utils/rooms.js');
    let m = 0;
    const t = (fn) => { fn(); m += 1; };

    const chores = [
        { id: 1, room: 'Kitchen', completed: false },
        { id: 2, room: 'Kitchen', completed: true },
        { id: 3, room: 'Attic', completed: true },
        { id: 4, room: 'Guest Room', completed: false },
        { id: 5, room: '', completed: false },
    ];

    t(() => {
        const b = board(chores);
        assert.equal(b.open, 3);
        assert.equal(b.done, 2);
        assert.equal(b.clean, false);
        assert.equal(b.empty, false);
    });

    t(() => {
        // Rooms with work first, Misc last among them, finished rooms after.
        assert.deepEqual(board(chores).rooms.map((r) => r.name),
            ['Guest Room', 'Kitchen', 'Misc', 'Attic']);
    });

    t(() => {
        // Undone before done inside a room.
        const kitchen = board(chores).rooms.find((r) => r.name === 'Kitchen');
        assert.deepEqual(kitchen.chores.map((c) => c.id), [1, 2]);
    });

    t(() => {
        const b = board([{ room: 'Kitchen', completed: true }]);
        assert.equal(b.clean, true, 'everything ticked off');
        assert.equal(b.open, 0);
    });

    t(() => {
        const b = board([]);
        assert.equal(b.empty, true);
        assert.equal(b.clean, false, 'nothing at all is not the same as nothing left');
        assert.equal(b.rooms.length, 5, 'the five suggestions');
    });

    console.log(`board: ${m} passed`);
}
