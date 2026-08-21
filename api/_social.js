/**
 * Reading a saved post.
 *
 * What is actually reachable from a server, tested rather than assumed:
 *
 *   TikTok    — oEmbed is public and needs no key, and its `title` field is
 *               the **full caption**, which is where a recipe or a list of
 *               tips normally lives. This is the good one.
 *   YouTube   — oEmbed gives title, author and thumbnail; the watch page's
 *               og:description gives the description.
 *   Web       — og/JSON-LD, already handled by _link.js and _recipe.js.
 *
 *   Instagram — 613KB of JavaScript with no metadata served to a server.
 *               Needs a Meta app and app review. Not attempted.
 *   Pinterest — 1.5MB shell, same story.
 *   Reddit    — the old .json endpoint now returns the web app; needs a
 *               registered OAuth client.
 *
 * For the three that refuse, the link is still saved with whatever she typed
 * or dictated alongside it. A save with only a URL and her own words beats an
 * error, and she can always paste the caption in.
 */

import { fetchHtml, firstMeta, decode } from './_html.js';

export const PLATFORMS = {
    tiktok: /(^|\.)tiktok\.com$/i,
    youtube: /(^|\.)(youtube\.com|youtu\.be)$/i,
    instagram: /(^|\.)instagram\.com$/i,
    pinterest: /(^|\.)pinterest\.[a-z.]+$/i,
    reddit: /(^|\.)reddit\.com$/i,
};

/** Which service a URL belongs to, or 'web'. */
export const platformOf = (url) => {
    let host;
    try {
        host = new URL(url).hostname;
    } catch {
        return null;
    }
    for (const [name, pattern] of Object.entries(PLATFORMS)) {
        if (pattern.test(host)) return name;
    }
    return 'web';
};

/** Services we know we cannot read, and why — said plainly rather than failing vaguely. */
export const UNREADABLE = {
    instagram: 'Instagram serves no readable text to anything but a signed-in browser',
    pinterest: 'Pinterest serves no readable text to anything but a signed-in browser',
    reddit: 'Reddit needs an authorised app to read posts',
};

/**
 * Share sheets hand over prose, not URLs: "check this out
 * https://vm.tiktok.com/ZM…/ 🔥". Pull the first link out and keep the rest as
 * her own words.
 */
export const firstUrl = (text) => {
    const match = String(text || '').match(/https?:\/\/[^\s<>"')\]]+/);
    if (!match) return null;
    // Trailing punctuation belongs to the sentence, not the link.
    return match[0].replace(/[.,;:!?]+$/, '');
};

/** Tracking noise that changes on every share and would defeat deduplication. */
const JUNK_PARAMS = /^(_[rt]|is_from_webapp|sender_device|sender_web_id|web_id|utm_[a-z_]+|si|feature|fbclid|gclid|igsh|share_id|_d|checksum|share_app_id|share_link_id|share_item_id|timestamp|user_id|tt_from|source)$/i;

export const canonical = (raw) => {
    let url;
    try {
        url = new URL(raw);
    } catch {
        return raw;
    }
    for (const key of [...url.searchParams.keys()]) {
        if (JUNK_PARAMS.test(key)) url.searchParams.delete(key);
    }
    return url.toString().replace(/\?$/, '');
};

/**
 * Share sheets give short links — vm.tiktok.com, youtu.be, bit.ly. TikTok's
 * oEmbed rejects those outright with a 400; it wants the canonical
 * /@user/video/id form. Follow the redirect and take where it landed.
 */
const SHORTENERS = /^(vm\.tiktok\.com|vt\.tiktok\.com|m\.tiktok\.com|bit\.ly|t\.co|tinyurl\.com|pin\.it|redd\.it)$/i;

export const expand = async (raw) => {
    let url;
    try {
        url = new URL(raw);
    } catch {
        return raw;
    }
    if (!SHORTENERS.test(url.hostname)) return canonical(raw);

    try {
        const res = await fetch(url.toString(), {
            redirect: 'follow',
            headers: {
                // A desktop user agent: some shorteners hand a mobile app deep
                // link to anything that looks like a phone.
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
                accept: 'text/html',
            },
            signal: AbortSignal.timeout(10000),
        });
        return canonical(res.url || raw);
    } catch {
        // The original link is still worth saving even unexpanded.
        return canonical(raw);
    }
};

const oembed = async (endpoint) => {
    const res = await fetch(endpoint, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`the post could not be read (${res.status})`);
    return res.json();
};

async function readTikTok(url) {
    const data = await oembed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
    return {
        platform: 'tiktok',
        // TikTok puts the whole caption in `title`. It is the caption, not a
        // title, and treating it as one produces absurd names — so it becomes
        // the excerpt and the title is trimmed from it.
        title: shorten(data.title),
        excerpt: data.title || null,
        author: data.author_name || null,
        thumbnail: data.thumbnail_url || null,
    };
}

async function readYouTube(url) {
    const data = await oembed(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    );

    // The description is not in oEmbed; the watch page carries it in og tags.
    let description = null;
    try {
        const { html } = await fetchHtml(url, 10000);
        description = firstMeta(html, ['og:description', 'description']);
    } catch {
        // Title and author alone are still worth saving.
    }

    return {
        platform: 'youtube',
        title: decode(data.title) || null,
        excerpt: description,
        author: data.author_name || null,
        thumbnail: data.thumbnail_url || null,
    };
}

async function readWeb(url) {
    const { html, url: finalUrl } = await fetchHtml(url);
    return {
        platform: 'web',
        title: firstMeta(html, ['og:title', 'twitter:title'])
            || decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1])
            || new URL(finalUrl).hostname,
        excerpt: firstMeta(html, ['og:description', 'twitter:description', 'description']),
        author: firstMeta(html, ['og:site_name', 'author']),
        thumbnail: firstMeta(html, ['og:image', 'twitter:image']),
    };
}

/** A caption is not a title. Cut it at the first sentence or hashtag. */
export const shorten = (caption, max = 80) => {
    if (!caption) return null;
    const clean = String(caption).split(/[#\n]/)[0].trim() || String(caption).trim();
    if (clean.length <= max) return clean;
    const cut = clean.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
};

/**
 * Read whatever is at `url`. Never throws: an unreadable post still deserves
 * to be saved with its link, and the reason is reported so the UI can say why
 * there is nothing to show.
 */
export async function readPost(rawUrl) {
    const url = await expand(rawUrl);
    const platform = platformOf(url);
    if (!platform) return { platform: null, url, readable: false, problem: 'that is not a link' };

    if (UNREADABLE[platform]) {
        return { platform, url, readable: false, problem: UNREADABLE[platform] };
    }

    try {
        const reader = platform === 'tiktok' ? readTikTok
            : platform === 'youtube' ? readYouTube
                : readWeb;
        const post = await reader(url);
        return { ...post, url, readable: Boolean(post.title || post.excerpt) };
    } catch (err) {
        return { platform, url, readable: false, problem: err.message };
    }
}
