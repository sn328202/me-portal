import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { readGoodreads, readLetterboxd, planImport, describePlan } from '../utils/shelfImport';
import { readZip, sniff, textOf, bytesOf } from '../utils/shelfFiles';

/**
 * A Goodreads or Letterboxd export, read and then — separately — written.
 *
 * Two steps on purpose. An importer that reads a file and writes it in the
 * same gesture is one she has to check by hand afterwards, every time, because
 * the only way to find out what it did is to go and look. This one says what
 * it found and waits: how many are new, how many she already has, how many it
 * left behind and why.
 *
 * Everything is read in the browser. Her reading diary and her viewing history
 * do not need to be uploaded for a CSV to be parsed, and the only reason to
 * send them anywhere would be that the parsing had to happen there.
 */

/** Postgres will take more, but a request that times out halfway through is
 *  worse than four that do not. */
const BATCH = 200;

/** TMDB lookups, per round trip. Matches the cap in `api/covers.js`. */
const POSTER_BATCH = 40;

const chunk = (list, size) => {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
};

/** The columns the table actually has. `isbn` is used to build a cover URL and
 *  is then done with — there is nowhere for it to live and nothing that reads
 *  it back. */
const forDb = (item, userId) => ({
    title: item.title,
    creator: item.creator || null,
    type: item.type,
    status: item.status || 'Completed',
    rating: item.rating ?? null,
    review: item.review || null,
    image_url: item.image_url || null,
    link: item.link || null,
    finished_at: item.finished_at || null,
    year: item.year ?? null,
    source: item.source,
    source_id: item.source_id,
    user_id: userId,
});

export const useShelfImport = (existing = [], onDone) => {
    const { user } = useAuth();
    const [reading, setReading] = useState(false);
    const [writing, setWriting] = useState(false);
    const [found, setFound] = useState(null);
    const [error, setError] = useState(null);
    const [note, setNote] = useState(null);

    const forget = useCallback(() => { setFound(null); setError(null); setNote(null); }, []);

    /** Step one: what is in this file? Nothing is written. */
    const read = useCallback(async (file) => {
        if (!file) return;
        setReading(true);
        setError(null);
        setNote(null);
        setFound(null);
        try {
            const isZip = /\.zip$/i.test(file.name);
            let items = [];
            let skipped = {};
            let from = null;
            let saw = [];

            if (isZip) {
                const { files, seen } = readZip(await bytesOf(file));
                if (!Object.keys(files).length) {
                    throw new Error(
                        `That ZIP has no Letterboxd CSVs in it${seen.length ? ` — it holds ${seen.slice(0, 4).join(', ')}` : ''}.`
                    );
                }
                ({ items, skipped } = readLetterboxd(files));
                from = 'letterboxd';
                saw = Object.keys(files);
            } else {
                const text = await textOf(file);
                const kind = sniff(file.name, text);
                if (kind === 'goodreads') {
                    ({ items, skipped } = readGoodreads(text));
                    from = 'goodreads';
                } else if (kind === 'letterboxd-csv') {
                    /* A single CSV pulled out of the ZIP. Which one it is
                       decides what can be read off it, and the filename is the
                       only clue — but every one of them carries the URI, so
                       the worst case is a film with no rating rather than no
                       film. */
                    const which = /diary/i.test(file.name) ? 'diary'
                        : /rating/i.test(file.name) ? 'ratings'
                            : /review/i.test(file.name) ? 'reviews' : 'watched';
                    ({ items, skipped } = readLetterboxd({ [which]: text }));
                    from = 'letterboxd';
                    saw = [which];
                } else {
                    throw new Error(
                        'That does not look like a Goodreads or Letterboxd export. '
                        + 'Goodreads: My Books → Import and Export → Export Library. '
                        + 'Letterboxd: Settings → Data → Export your data.'
                    );
                }
            }

            const plan = planImport(items, existing);
            setFound({ ...plan, from, saw, skipped, line: describePlan(plan, skipped) });
        } catch (err) {
            setError(err.message || 'That file could not be read.');
        } finally {
            setReading(false);
        }
    }, [existing]);

    /**
     * Step two: write it.
     *
     * `upsert` on the unique index rather than insert-then-update, so a second
     * export of the same shelf lands as one statement per batch and cannot
     * half-apply into duplicates. `finished_at` on an existing row is allowed
     * to move: re-reading a book is a real thing and the newer date is the
     * true one.
     */
    const write = useCallback(async () => {
        if (!user || !found) return;
        setWriting(true);
        setError(null);
        try {
            const rows = [...found.fresh, ...found.update].map((i) => forDb(i, user.id));
            let written = 0;

            for (const batch of chunk(rows, BATCH)) {
                const { error: err } = await supabase
                    .from('library_items')
                    .upsert(batch, { onConflict: 'user_id,source,source_id' });
                if (err) throw err;
                written += batch.length;
                setNote(`Filing… ${written} of ${rows.length}.`);
            }

            setNote(`${found.fresh.length} added, ${found.update.length} brought up to date.`);
            setFound(null);
            await onDone?.();
        } catch (err) {
            setError(err.message || 'That did not save.');
        } finally {
            setWriting(false);
        }
    }, [user, found, onDone]);

    /**
     * The posters, afterwards.
     *
     * Separate from the import because it is the one part that needs a key and
     * can therefore be the one part that is not ready yet. Films come in
     * without posters and this fills them in — now, or next month, or never.
     */
    const fillPosters = useCallback(async (films) => {
        if (!user) return;
        const want = (films || []).filter((f) => f.type === 'Movie' && !f.image_url);
        if (!want.length) { setNote('Every film already has a poster.'); return; }

        setWriting(true);
        setError(null);
        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session?.session?.access_token;
            let matched = 0;
            let done = 0;

            for (const batch of chunk(want, POSTER_BATCH)) {
                const res = await fetch('/api/covers', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                        films: batch.map((f) => ({ key: f.id, title: f.title, year: f.year })),
                    }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'The poster lookup would not answer.');
                if (json.configured === false) { setNote(json.note); return; }

                for (const hit of json.found || []) {
                    if (!hit.matched) continue;
                    const patch = {};
                    if (hit.image_url) patch.image_url = hit.image_url;
                    // The director is what a film's "creator" means, and the
                    // export does not carry one.
                    const film = batch.find((f) => f.id === hit.key);
                    if (hit.creator && !film?.creator) patch.creator = hit.creator;
                    if (!Object.keys(patch).length) continue;
                    await supabase.from('library_items').update(patch)
                        .eq('id', hit.key).eq('user_id', user.id);
                    matched += 1;
                }

                done += batch.length;
                setNote(`Looking up posters… ${done} of ${want.length}.`);
            }

            setNote(
                matched === want.length
                    ? `Found all ${matched}.`
                    : `Found ${matched} of ${want.length}. The rest TMDB could not place with confidence, so they were left alone rather than given the wrong film.`
            );
            await onDone?.();
        } catch (err) {
            setError(err.message || 'The posters did not come through.');
        } finally {
            setWriting(false);
        }
    }, [user, onDone]);

    return { read, write, fillPosters, forget, found, reading, writing, error, note };
};

export default useShelfImport;
