/**
 * The blanks, and what each one is called for each kind of thing.
 *
 * A prompt has to be worded for its medium or it reads as a form. "Comfort
 * rewatch" is right for a film and wrong for an album, which is not rewatched
 * but is always on; "the one that made me a reader" is a different sentence
 * from "the one that made me a gamer". The prompt is most of the design here —
 * the page is only as good as the questions, and a generic question gets a
 * generic answer.
 *
 * Order matters too. The four favourites come first because they are the
 * hardest and the most revealing; the yearly one comes last because it is the
 * one that will be blank in January.
 */

export const MEDIA = ['Book', 'Movie', 'TV Show', 'Album', 'Game'];

/** The verb each medium takes, for the prompts that need one. */
const VERB = {
    Book: { doing: 'Reading', person: 'reader', again: 'Comfort reread' },
    Movie: { doing: 'Watching', person: 'film person', again: 'Comfort rewatch' },
    'TV Show': { doing: 'Watching', person: 'watcher', again: 'Comfort rewatch' },
    Album: { doing: 'Listening to', person: 'listener', again: 'Always on' },
    Game: { doing: 'Playing', person: 'player', again: 'Comfort replay' },
};

const THING = {
    Book: 'book', Movie: 'film', 'TV Show': 'show', Album: 'album', Game: 'game',
};

/**
 * The prompts, in the order they appear.
 *
 * `slots` is how many things the prompt takes. `yearly` marks the one whose
 * answer belongs to a particular year rather than to all time.
 */
export const PROMPTS = [
    {
        id: 'top_four',
        slots: 4,
        title: () => 'Top four of all time',
        hint: (m) => `The four ${THING[m]}s you would defend. Not the best ones — yours.`,
    },
    {
        id: 'currently',
        slots: 2,
        title: (m) => `${VERB[m].doing} now`,
        hint: () => 'What you are in the middle of.',
    },
    {
        id: 'evangelist',
        slots: 1,
        title: () => 'The one I make everyone try',
        hint: (m) => `The ${THING[m]} you press on people whether or not they asked.`,
    },
    {
        id: 'comfort',
        slots: 1,
        title: (m) => VERB[m].again,
        hint: () => 'The one you go back to when you do not want to think.',
    },
    {
        id: 'underrated',
        slots: 1,
        title: () => 'Criminally underrated',
        hint: () => 'Nobody talks about it. They should.',
    },
    {
        id: 'gateway',
        slots: 1,
        title: () => 'The one that started it',
        hint: (m) => `What made you a ${VERB[m].person} in the first place.`,
    },
    {
        id: 'best_of',
        slots: 1,
        yearly: true,
        title: (m, year) => `Best of ${year}`,
        hint: () => 'So far. It is allowed to change.',
    },
];

export const promptById = (id) => PROMPTS.find((p) => p.id === id) || null;

/** This year, from the wall clock rather than from UTC. */
export const thisYear = (now = new Date()) => now.getFullYear();

/**
 * Which year a slot's row belongs to.
 *
 * Everything that is not the yearly prompt uses 0, so the unique index can
 * include the column without anyone having to reason about nulls.
 */
export const yearFor = (promptId, year) => (promptById(promptId)?.yearly ? year : 0);

/**
 * The picks for one medium, arranged as the page draws them: every prompt,
 * every slot, filled or empty.
 *
 * Empty slots are returned rather than omitted, because an unfilled blank is
 * the point — it is a question she has not answered yet, and a page that only
 * showed the answers would give her nowhere to put the next one.
 */
export const boardFor = (picks = [], media, year = thisYear()) => PROMPTS.map((prompt) => {
    const wanted = yearFor(prompt.id, year);
    const mine = picks.filter(
        (p) => p.media === media && p.slot === prompt.id && (p.year ?? 0) === wanted
    );

    const slots = Array.from({ length: prompt.slots }, (_, position) => (
        mine.find((p) => (p.position ?? 0) === position) || null
    ));

    return {
        id: prompt.id,
        title: prompt.title(media, year),
        hint: prompt.hint(media, year),
        yearly: Boolean(prompt.yearly),
        year: wanted,
        slots,
        filled: slots.filter(Boolean).length,
    };
});

/** How much of a medium's page she has actually answered. */
export const tally = (picks = [], media, year = thisYear()) => {
    const board = boardFor(picks, media, year);
    return {
        filled: board.reduce((n, row) => n + row.filled, 0),
        // "Right now" being empty is not an unanswered question — it means she
        // is between things, which is a real state and not a gap to nag about.
        of: board.reduce((n, row) => n + (row.id === 'currently' ? 0 : row.slots.length), 0),
    };
};

/** Where she keeps the real catalogue. Shown as links, not imported. */
export const ELSEWHERE = {
    Book: { label: 'Goodreads', href: 'https://www.goodreads.com/review/list?shelf=read' },
    Movie: { label: 'Letterboxd', href: 'https://letterboxd.com/films/' },
    'TV Show': { label: 'Letterboxd', href: 'https://letterboxd.com/films/' },
};
