import { createClient } from '@supabase/supabase-js';

/**
 * Searching for a thing, so a pick arrives with its cover on.
 *
 * Three of the five have to come through here, for two different reasons.
 * **Films and television** need TMDB, which wants a key, and the key stays in
 * Vercel. **Games** need Steam, which serves its store search happily to a
 * server and refuses it to a browser — checked, not assumed: `fetch` from the
 * page fails CORS outright.
 *
 * Books and albums do not come through here at all. Open Library and the
 * iTunes search API both answer a browser directly, so routing them through a
 * function of ours would add a hop, a cold start and a thing to maintain in
 * exchange for nothing. The dispatch lives in `src/utils/mediaSearch.js`.
 *
 * Everything returns the same shape, whatever answered it: title, creator,
 * year, image, link, and where it came from.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const TMDB_KEY = process.env.TMDB_API_KEY;
const POSTER = 'https://image.tmdb.org/t/p/w500';

const clean = (s) => String(s || '').trim();
const yearOf = (d) => Number(String(d || '').slice(0, 4)) || null;

/* ---------- TMDB: films and television ---------------------------------- */

const tmdb = async (path, params) => {
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    url.searchParams.set('api_key', TMDB_KEY);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`TMDB said ${res.status}`);
    return res.json();
};

/**
 * The director, or the creator of a show.
 *
 * Worth one extra call each for the handful of results she will actually look
 * at: "Céline Sciamma" is what a film's byline should say, and TMDB's search
 * results do not carry it. Only the top few, because the rest are never
 * chosen.
 */
const creditFor = async (kind, id) => {
    try {
        if (kind === 'tv') {
            const show = await tmdb(`/tv/${id}`, {});
            const names = (show.created_by || []).map((p) => p.name);
            if (names.length) return names.join(', ');
            return (show.networks || [])[0]?.name || null;
        }
        const { crew = [] } = await tmdb(`/movie/${id}/credits`, {});
        const names = crew.filter((c) => c.job === 'Director').map((c) => c.name);
        return names.length ? names.join(', ') : null;
    } catch {
        // A byline is a nicety. Losing it must not lose the result.
        return null;
    }
};

const NAMED = 4;

async function searchTmdb(kind, query) {
    const json = await tmdb(`/search/${kind}`, { query, include_adult: 'false' });
    const hits = (json.results || []).slice(0, 12);

    const bylines = await Promise.all(
        hits.slice(0, NAMED).map((h) => creditFor(kind, h.id))
    );

    return hits.map((h, i) => ({
        title: clean(h.title || h.name),
        creator: bylines[i] || null,
        year: yearOf(h.release_date || h.first_air_date),
        image_url: h.poster_path ? `${POSTER}${h.poster_path}` : null,
        link: `https://www.themoviedb.org/${kind}/${h.id}`,
        source: 'tmdb',
        source_id: `${kind}:${h.id}`,
    })).filter((r) => r.title);
}

/* ---------- Steam: games ------------------------------------------------ */

/**
 * Steam's store search. Undocumented, public, keyless, and the best answer
 * available without asking somebody for credentials — RAWG and IGDB both want
 * an account, which is a lot of setup for a page with five game slots on it.
 *
 * `tiny_image` is 231px wide, which is a header rather than box art. The
 * library capsule at a usable size is derivable from the app id, so that is
 * what is used, with the tiny one as the fallback.
 */
async function searchSteam(query) {
    const url = new URL('https://store.steampowered.com/api/storesearch/');
    url.searchParams.set('term', query);
    url.searchParams.set('cc', 'us');
    url.searchParams.set('l', 'en');

    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`Steam said ${res.status}`);
    const json = await res.json();

    return (json.items || []).slice(0, 12).map((g) => ({
        title: clean(g.name),
        creator: null,
        year: null,
        image_url: g.id
            ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.id}/library_600x900.jpg`
            : (g.tiny_image || null),
        // Something is always better than nothing here: if the tall capsule
        // does not exist for an older game, the header still does.
        fallback_image: g.tiny_image || null,
        link: g.id ? `https://store.steampowered.com/app/${g.id}` : null,
        source: 'steam',
        source_id: g.id ? String(g.id) : null,
    })).filter((r) => r.title);
}

/* ---------- the endpoint ------------------------------------------------ */

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

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const query = clean(body.query).slice(0, 120);
    const media = clean(body.media);
    if (!query) return res.status(200).json({ results: [] });

    try {
        if (media === 'Movie' || media === 'TV Show') {
            if (!TMDB_KEY) {
                return res.status(200).json({
                    results: [],
                    note: 'No TMDB key set, so films and shows cannot be looked up. Add TMDB_API_KEY in Vercel.',
                });
            }
            return res.status(200).json({
                results: await searchTmdb(media === 'Movie' ? 'movie' : 'tv', query),
            });
        }
        if (media === 'Game') {
            return res.status(200).json({ results: await searchSteam(query) });
        }
        return res.status(400).json({ error: `Nothing here looks up a ${media || 'thing'}.` });
    } catch (err) {
        // One search failing is a search that found nothing, not a broken page:
        // she can still type the title in by hand.
        return res.status(200).json({ results: [], note: err.message });
    }
}
