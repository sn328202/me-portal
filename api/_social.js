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

import { fetchHtml, firstMeta, decode, UA } from './_html.js';

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
    // The iOS share sheet now hands over www.tiktok.com/t/<code>/ — a short
    // link on the main host, which the hostname test alone would miss.
    const tiktokShort = /(^|\.)tiktok\.com$/i.test(url.hostname) && /^\/t\//.test(url.pathname);
    if (!SHORTENERS.test(url.hostname) && !tiktokShort) return canonical(raw);

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

/** The numeric id in a /@user/video/<id> link. */
export const tiktokIdOf = (url) => (String(url || '').match(/\/video\/(\d+)/) || [])[1] || null;

const scriptJson = (html, id) => {
    const m = html.match(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)</script>`));
    if (!m) return null;
    try {
        return JSON.parse(m[1]);
    } catch {
        return null;
    }
};

/**
 * The embed player page. Since Oct 2026 this is where the caption lives:
 * oEmbed still answers 200 but no longer carries title, author_name or
 * thumbnail_url — only the video id and the iframe. Nothing errors, so the
 * failure looked like "a post with no caption" rather than a broken reader.
 */
export const parseTikTokEmbed = (html) => {
    const state = scriptJson(html, '__FRONTITY_CONNECT_STATE__');
    const pages = state?.source?.data || {};
    const video = Object.values(pages).find((p) => p && p.videoData)?.videoData;
    if (!video) return null;
    return {
        caption: video.itemInfos?.text || null,
        author: video.authorInfos?.uniqueId || video.authorInfos?.nickName || null,
        thumbnail: video.itemInfos?.covers?.[0] || null,
    };
};

/** The full video page, as a last resort. Heavier, and more often refused. */
export const parseTikTokPage = (html) => {
    const data = scriptJson(html, '__UNIVERSAL_DATA_FOR_REHYDRATION__');
    const item = data?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
    if (!item) return null;
    return {
        caption: item.desc || null,
        author: item.author?.uniqueId || item.author?.nickname || null,
        thumbnail: item.video?.cover || item.video?.originCover || null,
    };
};

const fetchText = async (url) => {
    const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9', accept: 'text/html' },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`TikTok refused the page (${res.status})`);
    return { html: await res.text(), url: res.url };
};

async function readTikTok(url) {
    let caption = null;
    let author = null;
    let thumbnail = null;
    let id = tiktokIdOf(url);
    const tried = [];

    // oEmbed first: cheap, and if TikTok ever restores the caption there it
    // wins again without a code change.
    try {
        const data = await oembed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
        caption = data.title || null;
        author = data.author_name || null;
        thumbnail = data.thumbnail_url || null;
        id = id || data.embed_product_id || null;
    } catch (err) {
        tried.push(err.message);
    }

    const fill = (got) => {
        if (!got) return;
        caption = caption || got.caption;
        author = author || got.author;
        thumbnail = thumbnail || got.thumbnail;
    };

    if (!caption && id) {
        try {
            const { html } = await fetchText(`https://www.tiktok.com/embed/v2/${id}`);
            const got = parseTikTokEmbed(html);
            if (!got) tried.push('the embed page had no post data');
            fill(got);
        } catch (err) {
            tried.push(err.message);
        }
    }

    if (!caption) {
        try {
            const { html } = await fetchText(url);
            const got = parseTikTokPage(html);
            if (!got) tried.push('the video page had no post data');
            fill(got);
        } catch (err) {
            tried.push(err.message);
        }
    }

    if (!caption) {
        throw new Error(`TikTok gave back no caption${tried.length ? ` (${tried.join('; ')})` : ''}`);
    }

    return {
        platform: 'tiktok',
        // A caption is not a title; the title is trimmed from it.
        title: shorten(caption),
        excerpt: caption,
        author,
        thumbnail,
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
