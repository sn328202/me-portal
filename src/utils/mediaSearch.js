/**
 * Finding a thing to put in a blank, whatever kind of thing it is.
 *
 * Five media types, four different services, one shape out. Which service
 * answers is an implementation detail the page should never have to think
 * about — it asks for "Piranesi" as a Book and gets back something with a
 * title, a byline, a year and a cover.
 *
 * Two go straight from the browser and three go through `/api/lookup`, and
 * the split is not arbitrary:
 *
 * - **Books** — Open Library. Keyless, CORS-friendly, and its covers are
 *   addressable by id, so no second request.
 * - **Albums** — the iTunes Search API. Keyless, CORS-friendly, and the
 *   artwork URL carries its own size in the path, so a 100px thumbnail
 *   becomes a 600px cover by string replacement.
 * - **Films and television** — TMDB, which wants a key, and the key stays on
 *   the server.
 * - **Games** — Steam, which serves a server and refuses a browser. Checked
 *   rather than assumed: fetching it from the page fails CORS outright.
 */

import { supabase } from '../lib/supabase';

const clean = (s) => String(s || '').trim();

/* ---------- books ------------------------------------------------------- */

const searchBooks = async (query) => {
    const url = new URL('https://openlibrary.org/search.json');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '12');
    // Asking for the fields keeps the response small: unasked, Open Library
    // returns a few hundred kilobytes of edition data per search.
    url.searchParams.set('fields', 'title,author_name,first_publish_year,cover_i,key');

    const res = await fetch(url);
    if (!res.ok) throw new Error('Open Library would not answer.');
    const json = await res.json();

    return (json.docs || []).map((d) => ({
        title: clean(d.title),
        creator: (d.author_name || [])[0] || null,
        year: d.first_publish_year || null,
        image_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
        link: d.key ? `https://openlibrary.org${d.key}` : null,
        source: 'openlibrary',
        source_id: d.key || null,
    })).filter((r) => r.title);
};

/* ---------- albums ------------------------------------------------------ */

const searchAlbums = async (query) => {
    const url = new URL('https://itunes.apple.com/search');
    url.searchParams.set('term', query);
    url.searchParams.set('media', 'music');
    url.searchParams.set('entity', 'album');
    url.searchParams.set('country', 'US');
    url.searchParams.set('limit', '20');

    const res = await fetch(url);
    if (!res.ok) throw new Error('iTunes would not answer.');
    const json = await res.json();

    return (json.results || [])
        // Singles and EPs come back as albums of one or two tracks. A favourite
        // album is not a single, and the noise buries the real answers.
        .filter((a) => (a.trackCount || 0) > 2)
        .slice(0, 12)
        .map((a) => ({
            title: clean(a.collectionName),
            creator: clean(a.artistName) || null,
            year: Number(String(a.releaseDate || '').slice(0, 4)) || null,
            // The size is in the path, so a thumbnail is a cover away.
            image_url: (a.artworkUrl100 || '').replace('100x100', '600x600') || null,
            link: a.collectionViewUrl || null,
            source: 'itunes',
            source_id: a.collectionId ? String(a.collectionId) : null,
        }))
        .filter((r) => r.title);
};

/* ---------- films, television, games ------------------------------------ */

const searchServer = async (media, query) => {
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${session?.session?.access_token || ''}`,
        },
        body: JSON.stringify({ media, query }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'That search would not run.');
    return { results: json.results || [], note: json.note || null };
};

/* ---------- the one door ------------------------------------------------ */

export const CAN_SEARCH = ['Book', 'Movie', 'TV Show', 'Album', 'Game'];

/**
 * Results for a query, or a reason there are none.
 *
 * Never throws: a search that will not run is a search that found nothing,
 * because the fallback — typing the title in by hand — is always there and a
 * thrown error would take the page down instead of offering it.
 */
export const searchMedia = async (media, query) => {
    const q = clean(query);
    if (!q) return { results: [], note: null };

    try {
        if (media === 'Book') return { results: await searchBooks(q), note: null };
        if (media === 'Album') return { results: await searchAlbums(q), note: null };
        if (media === 'Movie' || media === 'TV Show' || media === 'Game') {
            return searchServer(media, q);
        }
        return { results: [], note: `Nothing looks up a ${media}.` };
    } catch (err) {
        return { results: [], note: err.message || 'That search would not run.' };
    }
};
