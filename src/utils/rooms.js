/**
 * Which rooms the chore board shows.
 *
 * The board listed five rooms as a constant — Kitchen, Study, Bedroom, Living
 * Room, Bathroom — and filtered on an exact string match. Every chore filed
 * anywhere else was still in the table, still incomplete, and had no tab that
 * would show it. Of the six rooms actually in use, four had no tab: the Guest
 * Room, the Guest Bathroom, the Laundry Room and the Main Bedroom. More than
 * half the open chores were invisible.
 *
 * So the rooms come from the chores now. Whatever she files something under
 * is a room, because she just used it as one; the five defaults are only a
 * starting point for a board with nothing on it yet.
 *
 * And nothing is allowed to have no room. A chore with a blank one goes to
 * Misc, which exists precisely so that "I could not work out where this
 * belongs" never means "this disappeared".
 */

export const MISC = 'Misc';

/** The five to start with, for a board that has never had anything on it. */
export const DEFAULT_ROOMS = ['Kitchen', 'Study', 'Bedroom', 'Living Room', 'Bathroom'];

/**
 * The name two spellings of one room agree on.
 *
 * "living room", "Living Room" and "Living  Room" are one place. Dictation
 * and typing disagree about capitals constantly, and a tab per capitalisation
 * is how a room quietly splits in two.
 */
export const roomKey = (room) => String(room ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Tidied for storing and showing: single spaces, and Each Word Capitalised. */
export const tidyRoom = (room) => {
    const text = String(room ?? '').trim().replace(/\s+/g, ' ');
    if (!text) return MISC;
    return text.replace(/\b[a-z]/g, (c) => c.toUpperCase());
};

/**
 * Every chore, under the room it belongs to.
 *
 * The display name is the first spelling seen rather than a tidied one, so a
 * room she deliberately called "the Nook" is not renamed to "The Nook" under
 * her.
 */
export const groupByRoom = (chores = []) => {
    const rooms = new Map();
    for (const chore of chores) {
        const key = roomKey(chore?.room) || roomKey(MISC);
        if (!rooms.has(key)) {
            rooms.set(key, { key, name: String(chore?.room || '').trim() || MISC, chores: [] });
        }
        rooms.get(key).chores.push(chore);
    }
    return rooms;
};

/**
 * The tabs, in the order they should read.
 *
 * Rooms with something in them first, alphabetically — the board is a place
 * to work through, and an order that changes as things are ticked off is a
 * board you lose your place on. Misc always last: it is the bucket, not a
 * room, and it should never be the first thing the eye lands on.
 */
export const roomsFrom = (chores = [], extra = []) => {
    const grouped = groupByRoom(chores);

    // Rooms she made on the board but has not filed anything under yet. They
    // have to survive a re-render or making a room does nothing visible.
    for (const name of extra) {
        const key = roomKey(name);
        if (key && !grouped.has(key)) grouped.set(key, { key, name: tidyRoom(name), chores: [] });
    }

    // Only when there is nothing at all: five suggestions beat an empty board
    // with nowhere to type.
    if (grouped.size === 0) {
        for (const name of DEFAULT_ROOMS) {
            grouped.set(roomKey(name), { key: roomKey(name), name, chores: [] });
        }
    }

    const list = [...grouped.values()].map((room) => ({
        ...room,
        open: room.chores.filter((c) => !c.completed).length,
        total: room.chores.length,
    }));

    const misc = roomKey(MISC);
    return list.sort((a, b) => {
        if ((a.key === misc) !== (b.key === misc)) return a.key === misc ? 1 : -1;
        return a.name.localeCompare(b.name);
    });
};

/**
 * Which tab to be on.
 *
 * Keeps the one she is on if it still exists; otherwise the first room with
 * something open in it, because a board that opens on an empty tab looks like
 * a board with nothing on it.
 */
export const pickRoom = (rooms = [], current = '') => {
    const key = roomKey(current);
    if (key && rooms.some((r) => r.key === key)) return key;
    return (rooms.find((r) => r.open > 0) || rooms[0])?.key || '';
};


/**
 * Everything still to do, in one list, grouped by room.
 *
 * The tabs were the right fix for "chores are invisible" and the wrong shape
 * for using the board: one room at a time means checking four tabs to find
 * out whether the flat is in order, and the answer to that question is a
 * single number.
 *
 * Rooms with nothing outstanding fall to the bottom rather than out, because
 * "the kitchen is done" is worth seeing once and worth nothing after that.
 */
export const board = (chores = [], extra = []) => {
    const rooms = roomsFrom(chores, extra).map((room) => ({
        ...room,
        // Undone first inside a room: ticking something off should move it out
        // of the way, not leave it holding its place.
        chores: [...room.chores].sort((a, b) => Number(Boolean(a.completed)) - Number(Boolean(b.completed))),
    }));

    const misc = roomKey(MISC);
    const withWork = rooms.filter((r) => r.open > 0);
    const done = rooms.filter((r) => r.open === 0);

    const order = (list) => [...list].sort((a, b) => {
        if ((a.key === misc) !== (b.key === misc)) return a.key === misc ? 1 : -1;
        return a.name.localeCompare(b.name);
    });

    return {
        rooms: [...order(withWork), ...order(done)],
        open: chores.filter((c) => !c?.completed).length,
        done: chores.filter((c) => c?.completed).length,
        // Nothing at all is not the same as nothing left, and they deserve
        // different words.
        clean: chores.length > 0 && chores.every((c) => c?.completed),
        empty: chores.length === 0,
    };
};
