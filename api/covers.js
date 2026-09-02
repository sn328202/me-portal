import { createClient } from '@supabase/supabase-js';

/**
 * Covers for an imported shelf.
 *
 * A shelf of six hundred titles in plain text is a spreadsheet. The covers are
 * what make it look like the thing it is a record of, and neither export
 * carries one: Goodreads' CSV has an ISBN and no image, Letterboxd's has a
 * URL to a page it will not let anyone read.
 *
 * Two different problems, so two different answers.
 *
 * **Books** need no request at all. Open Library serves covers by ISBN at a
 * predictable address, so the cover is a URL built from a column the export
 * already has. That happens in the browser; nothing about books reaches here.
 *
 * **Films** need a lookup. TMDB is the database Letterboxd itself points at
 * when it declines API access, and it wants a key — which is the entire reason
 * this endpoint exists. The key is in Vercel and stays there; the browser
 * sends titles and gets back image paths.
 *
 * Without a key this returns `configured: false` rather than an error, so the
 * import still runs and the posters can be filled in later. A missing poster
 * is a plainer card. A failed import is a lost afternoon.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const TMDB_KEY = process.env.TMDB_API_KEY;
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

/** How many films to look up in one request. TMDB is fine with this; a
 *  six-hundred-film shelf is not fine as one request. */
const MAX = 40;

const norm = (s) => String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * The right film, not the first film.
 *
 * TMDB's first result for "Dune" is whichever it thinks is most popular this
 * week, which for a shelf of things she watched years ago is regularly the
 * wrong one. The year is the tiebreaker the export always carries, so an exact
 * title match in the right year beats a popular near-miss — and when nothing
 * matches on both, nothing is claimed.
 */
export const bestMatch = (results = [], title, wantYear) => {
    const want = norm(title);
    const scored = results
        .map((r) => {
            const name = norm(r.title || r.name);
            const y = Number(String(r.release_date || '').slice(0, 4)) || null;
            let score = 0;
            if (name === want) score += 4;
            else if (name.startsWith(want) || want.startsWith(name)) score += 2;
            else return null;
            if (wantYear && y) {
                const gap = Math.abs(y - wantYear);
                if (gap === 0) score += 3;
                else if (gap === 1) score += 1;   // festival year vs release year
                else score -= 2;
            }
            return { r, score };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score || (b.r.popularity || 0) - (a.r.popularity || 0));

    const top = scored[0];
    return top && top.score >= 4 ? top.r : null;
};

async function lookupFilm({ title, year }) {
    const url = new URL('https://api.themoviedb.org/3/search/movie');
    url.searchParams.set('api_key', TMDB_KEY);
    url.searchParams.set('query', title);
    url.searchParams.set('include_adult', 'false');
    if (year) url.searchParams.set('year', String(year));

    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const json = await res.json();

    /* Asked with a year, TMDB returns only that year — which misses a film
       logged under its festival year. Asked without, it returns everything.
       So: the narrow question first, the wide one only if it came back empty. */
    let hit = bestMatch(json.results || [], title, year);
    if (!hit && year) {
        const wide = new URL(url);
        wide.searchParams.delete('year');
        const res2 = await fetch(wide, { headers: { accept: 'application/json' } });
        if (res2.ok) hit = bestMatch((await res2.json()).results || [], title, year);
    }
    if (!hit) return null;

    return {
        image_url: hit.poster_path ? `${IMAGE_BASE}${hit.poster_path}` : null,
        tmdb_id: hit.id,
        year: Number(String(hit.release_date || '').slice(0, 4)) || null,
    };
}

/** The director, which is what a film's "creator" means. One extra call, made
 *  only for films we actually matched. */
async function directorOf(tmdbId) {
    try {
        const url = new URL(`https://api.themoviedb.org/3/movie/${tmdbId}/credits`);
        url.searchParams.set('api_key', TMDB_KEY);
        const res = await fetch(url, { headers: { accept: 'application/json' } });
        if (!res.ok) return null;
        const { crew = [] } = await res.json();
        const names = crew.filter((c) => c.job === 'Director').map((c) => c.name);
        return names.length ? names.join(', ') : null;
    } catch {
        return null;
    }
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST with a session.' });
    if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Not configured.' });
    }

    const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!bearer) return res.status(401).json({ error: 'Sign in first.' });
    const { data: auth, error: authError } = await sb.auth.getUser(bearer);
    if (authError || !auth?.user) return res.status(401).json({ error: 'That session has expired.' });

    if (!TMDB_KEY) {
        return res.status(200).json({
            configured: false,
            found: [],
            note: 'No TMDB key set, so the films come in without posters. Add TMDB_API_KEY in Vercel and press the button again.',
        });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const films = Array.isArray(body.films) ? body.films.slice(0, MAX) : [];
    if (!films.length) return res.status(200).json({ configured: true, found: [] });

    const found = await Promise.all(films.map(async (f) => {
        const title = String(f?.title || '').trim();
        if (!title) return null;
        try {
            const hit = await lookupFilm({ title, year: f.year || null });
            if (!hit) return { key: f.key, matched: false };
            const creator = await directorOf(hit.tmdb_id);
            return { key: f.key, matched: true, ...hit, creator };
        } catch {
            // One film TMDB will not answer for must not cost the other
            // thirty-nine their posters.
            return { key: f.key, matched: false };
        }
    }));

    return res.status(200).json({ configured: true, found: found.filter(Boolean) });
}
