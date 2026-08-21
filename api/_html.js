/**
 * Shared page-fetching and HTML-poking helpers.
 *
 * Both the recipe importer and the Treasury link extractor need the same three
 * things: fetch a page like a browser would, pull its JSON-LD blocks out, and
 * read its meta tags. There is no DOM server-side, so this is regex work —
 * deliberately narrow, and tolerant of the malformed markup real sites ship.
 *
 * Underscore prefix keeps Vercel from publishing it as a route.
 */

export const UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/125.0 Safari/537.36';

const ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    '#39': "'", '#34': '"', frac12: '½', frac14: '¼', frac34: '¾',
    mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘',
    ldquo: '“', rdquo: '”', trade: '™', reg: '®', deg: '°',
};

/** Decode entities, strip tags, collapse whitespace. */
export const decode = (s) =>
    String(s || '')
        .replace(/&(#x?[0-9a-f]+|[a-z0-9]+);/gi, (m, code) => {
            const key = code.toLowerCase();
            if (ENTITIES[key]) return ENTITIES[key];
            if (key.startsWith('#x')) return String.fromCodePoint(parseInt(key.slice(2), 16));
            if (key.startsWith('#')) return String.fromCodePoint(parseInt(key.slice(1), 10));
            return m;
        })
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

/** Every parseable JSON-LD block on the page. */
export const jsonLdBlocks = (html) => {
    const out = [];
    const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const body = m[1].replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '').trim();
        try {
            out.push(JSON.parse(body));
        } catch {
            // Sites ship malformed JSON-LD more often than you would hope.
            // One bad block must not cost us the good one next to it.
        }
    }
    return out;
};

/**
 * Read a meta tag by property or name. Attribute order varies between sites,
 * so both orderings are tried.
 */
export const metaTag = (html, prop) => {
    const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const forward = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${esc}["'][^>]+content=["']([^"']*)["']`, 'i');
    const reverse = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name|itemprop)=["']${esc}["']`, 'i');
    const m = html.match(forward) || html.match(reverse);
    return m ? decode(m[1]) : null;
};

/** First non-null result from a list of meta property names. */
export const firstMeta = (html, props) => {
    for (const p of props) {
        const v = metaTag(html, p);
        if (v) return v;
    }
    return null;
};

/**
 * These functions fetch URLs chosen by whoever is talking to the app, from
 * inside Vercel's network. Refuse anything pointing at localhost, a private
 * range, or a cloud metadata endpoint, so a pasted link cannot be used to probe
 * from the inside.
 */
export const isPrivateHost = (hostname) => {
    const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (!h) return true;
    if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
    if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;

    const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!v4) return false;
    const [a, b] = v4.slice(1).map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;   // link-local, incl. cloud metadata
    return false;
};

/**
 * Fetch a page as a browser would. Throws messages written to be read aloud
 * in a phone notification rather than logged.
 */
export async function fetchHtml(url, timeoutMs = 12000) {
    let target;
    try {
        target = new URL(url);
    } catch {
        throw new Error('that does not look like a link');
    }
    if (!/^https?:$/.test(target.protocol)) throw new Error('only web links can be opened');
    if (isPrivateHost(target.hostname)) throw new Error('that address is not reachable');

    try {
        const res = await fetch(target.toString(), {
            redirect: 'follow',
            headers: {
                'user-agent': UA,
                accept: 'text/html,application/xhtml+xml',
                'accept-language': 'en-US,en;q=0.9',
            },
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) throw new Error(`the site answered ${res.status}`);
        return { html: await res.text(), url: res.url || target.toString() };
    } catch (err) {
        throw new Error(
            err.name === 'TimeoutError'
                ? 'the site took too long to answer'
                : (err.message || 'the site could not be reached')
        );
    }
}
