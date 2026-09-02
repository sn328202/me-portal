/**
 * Reading a CSV that was written by someone else.
 *
 * Splitting on commas gets you through about four rows of a Goodreads export
 * before it meets a review containing a comma, and about forty before it meets
 * one containing a line break — which is legal, common, and the reason a
 * hand-rolled `split(',')` produces a file that looks imported and is quietly
 * shredded from row 41 onward.
 *
 * So this is a real reader: quoted fields, doubled quotes inside them, commas
 * and newlines inside them, and CRLF, which is what both Goodreads and
 * Letterboxd actually emit.
 *
 * It is deliberately small. There is no streaming, no type inference and no
 * configuration: the files are a few hundred kilobytes and every value is
 * interpreted by the importer that asked for it, which knows what it means.
 */

/** Rows of raw strings, quotes resolved. */
export const parseCsv = (text) => {
    const src = String(text ?? '').replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    let started = false;

    const endField = () => { row.push(field); field = ''; started = true; };
    const endRow = () => {
        endField();
        // A trailing newline is not a row of one empty field.
        if (!(row.length === 1 && row[0] === '')) rows.push(row);
        row = [];
        started = false;
    };

    for (let i = 0; i < src.length; i += 1) {
        const c = src[i];

        if (quoted) {
            if (c === '"') {
                // "" inside a quoted field is one literal quote.
                if (src[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
            } else {
                field += c;
            }
            continue;
        }

        if (c === '"' && field === '') { quoted = true; continue; }
        if (c === ',') { endField(); continue; }
        if (c === '\r') { if (src[i + 1] === '\n') i += 1; endRow(); continue; }
        if (c === '\n') { endRow(); continue; }
        field += c;
    }

    if (field !== '' || row.length || started) endRow();
    return rows;
};

/**
 * The same, as objects keyed by the header row.
 *
 * Headers are normalised — lowercased, punctuation dropped, spaces collapsed —
 * because both services have quietly renamed columns over the years and a
 * parser that insists on "Date Read" exactly is a parser that breaks on an
 * export from a different year of the same site. `dateRead`, `Date Read` and
 * `date_read` all arrive here as `date read`.
 */
export const normaliseHeader = (h) => String(h ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const readTable = (text) => {
    const rows = parseCsv(text);
    if (!rows.length) return { headers: [], rows: [] };

    const headers = rows[0].map(normaliseHeader);
    const out = rows.slice(1).map((cells) => {
        const o = {};
        headers.forEach((h, i) => { if (h) o[h] = (cells[i] ?? '').trim(); });
        return o;
    });
    return { headers, rows: out };
};

/**
 * The first of these columns that this file actually has.
 *
 * Written as a list rather than a name because the whole point is surviving
 * the rename: Letterboxd's watch date has been `Watched Date` and `Date`
 * depending on which file inside the export you are reading.
 */
export const pick = (row, ...names) => {
    for (const n of names) {
        const v = row[normaliseHeader(n)];
        if (v !== undefined && v !== '') return v;
    }
    return '';
};
