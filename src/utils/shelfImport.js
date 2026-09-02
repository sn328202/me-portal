/**
 * Goodreads and Letterboxd, read into the Library.
 *
 * Neither can be asked. Goodreads stopped issuing API keys in 2020 and
 * Letterboxd's API is invitation-only and says plainly that personal projects
 * are not granted access. What both still do — freely, and without anyone's
 * permission — is hand you your own data as a file. So the import is a file,
 * the way the trip spreadsheet is a file, and for the same reason: a file
 * needs nobody's approval and does not stop working when a policy changes.
 *
 * Only finished things come across. The to-read shelf and the watchlist are
 * hundreds of items apiece and they are a different kind of object — a wish,
 * not a record — and putting them in the same list would bury the reason the
 * list is worth opening.
 *
 * Nothing here touches the network or the browser. Given text, it returns
 * rows; deciding what to do with them is somebody else's job, and that is what
 * makes it testable without an export in hand.
 */

import { readTable, pick } from './csv.js';

/* ---------- shared ------------------------------------------------------ */

const clean = (s) => String(s ?? '').trim();

/** ISO date, or null. Both files use YYYY-MM-DD, but not every row has one. */
const isoDate = (v) => {
    const s = clean(v);
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    // Goodreads has emitted YYYY/MM/DD in older exports.
    const slash = /^(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(s);
    if (slash) {
        const [, y, mo, d] = slash;
        return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return null;
};

const year = (v) => {
    const n = Number(clean(v));
    return Number.isInteger(n) && n > 1400 && n < 2200 ? n : null;
};

/** Stars, kept in halves. 0 in both exports means "not rated", not "zero". */
const stars = (v) => {
    const n = Number(clean(v));
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.min(5, Math.round(n * 2) / 2);
};

/* ---------- Goodreads --------------------------------------------------- */

/**
 * Goodreads writes ISBNs as `="9780099580485"` so that Excel does not eat the
 * leading zero and turn the rest into scientific notation. It is a spreadsheet
 * escape, not part of the number.
 */
export const isbnOf = (row) => {
    const raw = pick(row, 'ISBN13', 'ISBN');
    const digits = clean(raw).replace(/^="?|"?=?$/g, '').replace(/[^0-9Xx]/g, '');
    if (digits.length === 13 || digits.length === 10) return digits.toUpperCase();
    return null;
};

/**
 * The author, as a person rather than a database entry.
 *
 * Goodreads gives "Le Guin, Ursula K." in `Author l-f` and "Ursula K. Le Guin"
 * in `Author`, so the readable one is already there — but the sort form is
 * what survives when the other is blank.
 */
const authorOf = (row) => {
    const plain = clean(pick(row, 'Author'));
    if (plain) return plain;
    const sorted = clean(pick(row, 'Author l-f'));
    const m = /^([^,]+),\s*(.+)$/.exec(sorted);
    return m ? `${m[2]} ${m[1]}` : sorted;
};

export const readGoodreads = (text) => {
    const { rows } = readTable(text);
    const skipped = { unread: 0, untitled: 0 };
    const books = [];

    for (const row of rows) {
        /* `Exclusive Shelf` is the one shelf a book can only be on one of:
           read, currently-reading, or to-read. A book can also carry any
           number of ordinary shelves, which is why the plural column is not
           the one to test. */
        const shelf = clean(pick(row, 'Exclusive Shelf')).toLowerCase();
        const finished = isoDate(pick(row, 'Date Read'));

        // Read means read. A book with a read date but a stale shelf is still
        // a book she finished — the date is the harder evidence of the two.
        if (shelf !== 'read' && !finished) { skipped.unread += 1; continue; }

        const title = clean(pick(row, 'Title'));
        if (!title) { skipped.untitled += 1; continue; }

        const id = clean(pick(row, 'Book Id'));
        books.push({
            type: 'Book',
            title,
            creator: authorOf(row) || null,
            status: 'Completed',
            rating: stars(pick(row, 'My Rating')),
            review: clean(pick(row, 'My Review')) || null,
            finished_at: finished,
            year: year(pick(row, 'Original Publication Year', 'Year Published')),
            isbn: isbnOf(row),
            image_url: bookCover(isbnOf(row)),
            link: id ? `https://www.goodreads.com/book/show/${id}` : null,
            source: 'goodreads',
            source_id: id || `title:${title.toLowerCase()}`,
        });
    }

    return { items: books, skipped };
};

/* ---------- Letterboxd -------------------------------------------------- */

/**
 * A film is one thing across four files.
 *
 * The export splits what it knows: `diary.csv` has the watch dates and
 * rewatches, `ratings.csv` the stars, `reviews.csv` the text, `watched.csv`
 * the full list including everything logged before she kept a diary.
 *
 * **The Letterboxd URI is not a film id.** It looked like the obvious key and
 * it is not one: in `watched.csv` and `ratings.csv` it points at the film, but
 * in `diary.csv` and `reviews.csv` it points at *that entry* — the diary row,
 * the review. Measured on a real export of 1,185 films: watched and diary
 * share **zero** URIs, while every one of the 118 diary films matches a
 * watched film on title and year. Keying on the URI silently turned every
 * diary entry into a second copy of a film she had already seen.
 *
 * So the key is title and year. It is the only thing all four files agree on,
 * and in that same export it produced exactly 1,185 films with no duplicates
 * inside `watched.csv` at all. Two different films sharing a title *and* a
 * release year would collide; that is a real if uncommon thing, and it is a
 * far smaller wrong than the one it replaces.
 */
const uriOf = (row) => clean(pick(row, 'Letterboxd URI', 'URI', 'url')) || null;

/* Accents and punctuation are not the difference between two films, and the
   same title is spelled identically across the four files anyway — this is
   belt and braces against an export that is tidied up later. */
const keyOf = (row) => {
    const name = clean(pick(row, 'Name', 'Title'))
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');
    return name ? `${name}|${clean(pick(row, 'Year'))}` : '';
};

/**
 * The newest thing she wrote about a film wins.
 *
 * A film watched twice has two reviews, and taking whichever came last in the
 * file assumes the file is in date order — which it is, until it is not. Her
 * real export has exactly one of these (*Materialists*, seen twice in 2025)
 * and the two reviews say different things, so the rule has to be a rule
 * rather than a habit of the file.
 */
const keepReview = (film, text, when) => {
    const words = clean(text);
    if (!words) return;
    const at = when || '';
    if (film.review && film.reviewedAt && at < film.reviewedAt) return;
    film.review = words;
    film.reviewedAt = at;
};

export const readLetterboxd = (files = {}) => {
    const byKey = new Map();
    const skipped = { untitled: 0 };

    const touch = (row) => {
        const key = keyOf(row);
        const name = clean(pick(row, 'Name', 'Title'));
        if (!key || !name) { skipped.untitled += 1; return null; }
        if (!byKey.has(key)) {
            byKey.set(key, {
                type: 'Movie',
                title: name,
                creator: null,
                status: 'Completed',
                rating: null,
                review: null,
                finished_at: null,
                // Which viewing the kept review belongs to; dropped on the
                // way out, since nothing downstream has a column for it.
                reviewedAt: null,
                year: year(pick(row, 'Year')),
                // Filled in from watched.csv / ratings.csv below, which are
                // the two files whose URI is the film's rather than a row's.
                link: null,
                source: 'letterboxd',
                source_id: key,
            });
        }
        const film = byKey.get(key);
        if (!film.year) film.year = year(pick(row, 'Year'));
        return film;
    };

    const table = (name) => (files[name] ? readTable(files[name]).rows : []);

    /* Watched first, so the list is complete before the detail is laid over
       it. A film watched before she kept a diary has a row here and nowhere
       else, and leaving it out would make the Library smaller than the truth.

       Its URI is also the only one worth keeping as a link: this file and
       `ratings.csv` point at the film, the other two point at a diary entry.
       A card that opens her own diary row instead of the film is a link that
       looks right and goes somewhere else. */
    for (const row of table('watched')) {
        const film = touch(row);
        if (!film) continue;
        film.finished_at = film.finished_at || isoDate(pick(row, 'Date'));
        film.link = uriOf(row) || film.link;
    }

    /* Ratings second, for the same reason: the URI here is the film's too, so
       a film she rated but never logged still gets a link that goes somewhere
       useful. */
    for (const row of table('ratings')) {
        const film = touch(row);
        if (!film) continue;
        if (!film.link) film.link = uriOf(row);
    }

    /* The diary is the better date: `Watched Date` is when she saw it, `Date`
       is when she logged it, and those are the same day only sometimes. The
       latest viewing wins, because that is the one she remembers. */
    for (const row of table('diary')) {
        const film = touch(row);
        if (!film) continue;
        const seen = isoDate(pick(row, 'Watched Date')) || isoDate(pick(row, 'Date'));
        if (seen && (!film.finished_at || seen > film.finished_at)) film.finished_at = seen;
        const r = stars(pick(row, 'Rating'));
        if (r != null) film.rating = r;
        keepReview(film, pick(row, 'Review'), seen);
    }

    for (const row of table('ratings')) {
        const film = touch(row);
        if (!film) continue;
        const r = stars(pick(row, 'Rating'));
        if (r != null) film.rating = r;
    }


    /* Reviews last: the written word beats everything, and the diary's copy of
       it can be the older one when a review has been edited since. */
    for (const row of table('reviews')) {
        const film = touch(row);
        if (!film) continue;
        const seen = isoDate(pick(row, 'Watched Date')) || isoDate(pick(row, 'Date'));
        keepReview(film, pick(row, 'Review'), seen);
        const r = stars(pick(row, 'Rating'));
        if (r != null && film.rating == null) film.rating = r;
        if (seen && !film.finished_at) film.finished_at = seen;
    }

    const items = [...byKey.values()]
        // `reviewedAt` is bookkeeping for which viewing the kept review came
        // from; nothing downstream has a column for it.
        .map((film) => { const { reviewedAt: _drop, ...rest } = film; return rest; })
        .sort((a, b) => String(b.finished_at || '').localeCompare(String(a.finished_at || '')));

    return { items, skipped };
};

/* ---------- covers ------------------------------------------------------ */

/**
 * A book cover, without asking anyone.
 *
 * Open Library serves covers at an address derived from the ISBN, so this is
 * not a lookup at all — it is a URL built from a column the export already
 * has, with no key, no rate limit and no endpoint of our own. `default=false`
 * makes a missing cover a 404 rather than a grey placeholder that looks like
 * a cover until you squint, which is what lets the card fall back to its own
 * "No Cover" rather than showing Open Library's.
 *
 * Films get none of this: Letterboxd carries no image and TMDB wants a key,
 * which is what `api/covers.js` is for.
 */
export const bookCover = (isbn) => (
    isbn ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false` : null
);

/* ---------- what an import would do -------------------------------------- */

/**
 * Split what was read against what is already on the shelf.
 *
 * Matched on `source` + `source_id`, which is the pair the database has a
 * unique index on, so this preview and what the write actually does cannot
 * disagree. Everything already there is reported as an update rather than
 * hidden: a re-import after re-reading a book should move its date, and
 * saying "12 already there" out loud is how she knows it will not double.
 */
export const planImport = (items = [], existing = []) => {
    const have = new Map();
    for (const row of existing) {
        if (row?.source && row?.source_id) have.set(`${row.source}|${row.source_id}`, row);
    }

    const fresh = [];
    const update = [];
    for (const item of items) {
        const seen = have.get(`${item.source}|${item.source_id}`);
        if (seen) update.push({ ...item, id: seen.id });
        else fresh.push(item);
    }
    return { fresh, update };
};

/** One line, in words, of what is about to happen. */
export const describePlan = ({ fresh = [], update = [] } = {}, skipped = {}) => {
    const bits = [];
    if (fresh.length) bits.push(`${fresh.length} new`);
    if (update.length) bits.push(`${update.length} already here`);
    if (!bits.length) bits.push('nothing to bring in');
    const missed = Object.values(skipped).reduce((a, b) => a + (b || 0), 0);
    const tail = missed ? `, ${missed} left behind` : '';
    return bits.join(', ') + tail;
};
