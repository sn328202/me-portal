/**
 * Turning what she dropped into something the importer can read.
 *
 * Goodreads hands you one CSV. Letterboxd hands you a ZIP of about eighteen,
 * sometimes inside a dated folder, and the names have moved between versions.
 * So a reader that looks for exact paths is a reader that works on this year's
 * export — but a reader that matches only the *last* segment is worse, because
 * a real export contains `deleted/diary.csv`, `orphaned/diary.csv` and
 * `likes/films.csv` alongside the real ones.
 *
 * Matching on the basename alone, `deleted/diary.csv` is a diary and
 * `likes/films.csv` is a list of watched films. Neither is true. Which one won
 * came down to the order entries happened to sit in the archive, which is a
 * coin toss dressed as a rule: on the export this was fixed against, the real
 * files happened to come first and it worked by luck.
 *
 * So depth decides. The shallowest match wins, and the four folders Letterboxd
 * uses for things that are *not* her watch history are refused outright.
 *
 * The archive is unzipped in the browser — `fflate` is already here for the
 * spreadsheet work. Nothing is uploaded to read it: this is her viewing
 * history, and the only reason to send it anywhere would be that the parsing
 * had to happen there, which it does not.
 */

import { unzipSync, strFromU8 } from 'fflate';

/** The Letterboxd files worth reading, and the names they have gone by. */
const WANTED = {
    watched: ['watched.csv', 'films.csv'],
    diary: ['diary.csv'],
    ratings: ['ratings.csv'],
    reviews: ['reviews.csv'],
};

/* Folders holding something that is not her watch history. `likes/films.csv`
   is films she liked the *reviews* of; `deleted` and `orphaned` are rows
   Letterboxd could no longer place; `lists` are her own lists. All four
   contain filenames identical to the real ones. */
const NOT_HISTORY = /(^|\/)(deleted|orphaned|likes|lists)\//i;

const parts = (path) => String(path).toLowerCase().split('/').filter(Boolean);

/** The CSVs out of a Letterboxd export, keyed by what they are. */
export const readZip = (bytes) => {
    const files = unzipSync(new Uint8Array(bytes));
    const best = {};
    const seen = [];

    for (const [path, data] of Object.entries(files)) {
        const bits = parts(path);
        const name = bits[bits.length - 1];
        if (!name || !name.endsWith('.csv')) continue;
        seen.push(name);
        if (NOT_HISTORY.test(`/${bits.join('/')}`)) continue;

        // A dated wrapper folder is not depth that means anything; what
        // matters is how far below the export's root a file sits.
        const depth = bits.length - 1;

        for (const [key, names] of Object.entries(WANTED)) {
            if (!names.includes(name)) continue;
            const rank = names.indexOf(name);
            const held = best[key];
            // Shallower wins; at equal depth the earlier-listed alias wins,
            // so `watched.csv` beats a stray `films.csv` beside it.
            if (!held || depth < held.depth || (depth === held.depth && rank < held.rank)) {
                best[key] = { depth, rank, text: strFromU8(data) };
            }
        }
    }

    const out = {};
    for (const [key, held] of Object.entries(best)) out[key] = held.text;
    return { files: out, seen };
};

/**
 * Which service a dropped file came from.
 *
 * By content, not by filename: both services let you rename the download, and
 * "export.csv" is what a browser calls the second copy of anything. A ZIP is a
 * Letterboxd export because Goodreads does not make one; a CSV is told apart
 * by a column only one of them has.
 */
export const sniff = (name, text) => {
    if (/\.zip$/i.test(name || '')) return 'letterboxd';
    const head = String(text || '').slice(0, 2000).toLowerCase();
    if (head.includes('exclusive shelf') || head.includes('book id')) return 'goodreads';
    if (head.includes('letterboxd uri')) return 'letterboxd-csv';
    return null;
};

/** Read a File the way the browser gives it to us. */
export const textOf = (file) => new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result || ''));
    r.onerror = () => no(new Error('That file could not be read.'));
    r.readAsText(file);
});

export const bytesOf = (file) => new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => no(new Error('That file could not be read.'));
    r.readAsArrayBuffer(file);
});
