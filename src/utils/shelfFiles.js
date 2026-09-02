/**
 * Turning what she dropped into something the importer can read.
 *
 * Goodreads hands you one CSV. Letterboxd hands you a ZIP of about eight,
 * inside a dated folder, and the names have moved between versions —
 * `watched.csv` has also been `films.csv`, and older exports nest everything
 * under `letterboxd-<user>-<date>-utc/`. So a reader that looks for exact
 * paths is a reader that works on this year's export.
 *
 * Everything is matched on the *last* path segment, case-insensitively, and
 * the archive is unzipped in the browser — `fflate` is already here for the
 * spreadsheet work. Nothing is uploaded to read it: this is her reading diary
 * and her viewing history, and the only reason to send it anywhere would be
 * that the parsing had to happen there, which it does not.
 */

import { unzipSync, strFromU8 } from 'fflate';

/** The Letterboxd files worth reading, and the names they have gone by. */
const WANTED = {
    watched: ['watched.csv', 'films.csv'],
    diary: ['diary.csv'],
    ratings: ['ratings.csv'],
    reviews: ['reviews.csv'],
};

const baseName = (path) => String(path).split('/').pop().toLowerCase();

/** The CSVs out of a Letterboxd export, keyed by what they are. */
export const readZip = (bytes) => {
    const files = unzipSync(new Uint8Array(bytes));
    const out = {};
    const seen = [];

    for (const [path, data] of Object.entries(files)) {
        const name = baseName(path);
        if (!name.endsWith('.csv')) continue;
        seen.push(name);
        for (const [key, names] of Object.entries(WANTED)) {
            if (names.includes(name) && !out[key]) out[key] = strFromU8(data);
        }
    }

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
