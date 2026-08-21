/**
 * Product extraction for the Treasury.
 *
 * The Treasury's Auto-Fill currently calls api.microlink.io from the browser,
 * which returns title, image and description only — the price is then guessed
 * by running a `$[\d,]+` regex over the description, which almost never finds
 * anything. It is also a third-party service on a free tier of roughly fifty
 * requests a day.
 *
 * Shops publish real structured data because Google requires it for shopping
 * results: schema.org Product with an Offer carrying price and currency. Read
 * that instead of guessing.
 */

import { decode, jsonLdBlocks, firstMeta, fetchHtml } from './_html.js';

const typeOf = (node) => {
    const t = node && node['@type'];
    return Array.isArray(t) ? t : [t].filter(Boolean);
};

const findByType = (node, wanted, depth = 0) => {
    if (depth > 5 || !node || typeof node !== 'object') return null;
    if (typeOf(node).some((t) => wanted.includes(t))) return node;
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findByType(child, wanted, depth + 1);
            if (found) return found;
        }
        return null;
    }
    if (Array.isArray(node['@graph'])) return findByType(node['@graph'], wanted, depth + 1);
    return null;
};

/**
 * "$1,299.00" / "1299" / "USD 89.95" -> 1299 / 1299 / 89.95
 * Returns null rather than 0 for junk, so "no price found" stays
 * distinguishable from "this thing is free".
 */
export const parsePrice = (raw) => {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;

    const text = String(raw).trim();
    // Strip currency symbols and codes, keep digits, separators and a sign.
    const cleaned = text.replace(/[^\d.,]/g, '');
    if (!cleaned) return null;

    // Decide which separator is the decimal point by whichever comes last:
    // "1.299,00" is European, "1,299.00" is not.
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    let normalised;
    if (lastComma > lastDot) {
        normalised = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
        normalised = cleaned.replace(/,/g, '');
    }

    const n = Number.parseFloat(normalised);
    return Number.isFinite(n) && n >= 0 ? n : null;
};

const CURRENCY_SYMBOLS = { $: 'USD', '£': 'GBP', '€': 'EUR', '¥': 'JPY', '₹': 'INR' };

const guessCurrency = (raw, fallback) => {
    if (fallback) return String(fallback).toUpperCase().slice(0, 3);
    const text = String(raw || '');
    const code = text.match(/\b(USD|GBP|EUR|CAD|AUD|JPY|INR|CHF|SEK|NOK|DKK)\b/i);
    if (code) return code[1].toUpperCase();
    for (const [symbol, iso] of Object.entries(CURRENCY_SYMBOLS)) {
        if (text.includes(symbol)) return iso;
    }
    return null;
};

/** offers may be an Offer, an AggregateOffer, or an array of either. */
const readOffer = (offers) => {
    if (!offers) return {};
    const list = Array.isArray(offers) ? offers : [offers];

    for (const offer of list) {
        if (!offer || typeof offer !== 'object') continue;
        const amount = parsePrice(
            offer.price ?? offer.lowPrice ?? offer.priceSpecification?.price
        );
        if (amount === null) continue;
        return {
            amount,
            currency: guessCurrency(offer.price, offer.priceCurrency || offer.priceSpecification?.priceCurrency),
            // "InStock", "https://schema.org/InStock", "OutOfStock"
            inStock: offer.availability ? /InStock|LimitedAvailability|PreOrder/i.test(offer.availability) : null,
        };
    }
    return {};
};

const firstImage = (image) => {
    if (!image) return null;
    const pick = Array.isArray(image) ? image[0] : image;
    if (typeof pick === 'string') return pick;
    if (pick && typeof pick === 'object') return pick.url || pick.contentUrl || null;
    return null;
};

const brandName = (brand) => {
    if (!brand) return null;
    if (typeof brand === 'string') return decode(brand);
    if (Array.isArray(brand)) return brandName(brand[0]);
    return brand.name ? decode(brand.name) : null;
};

/**
 * Tidy a brand derived from a domain or a site name. hario-usa.com is Hario;
 * everlane.com is Everlane.
 *
 * Only domain-shaped input is stripped. Anything containing a space is a name
 * someone deliberately chose and is returned untouched — otherwise "Some Shop"
 * loses its second word and "The Container Store" becomes "The Container".
 */
const REGIONAL = /^(usa|us|uk|eu|ca|au|official|store|shop|online|inc|llc|ltd)$/i;

const tidyBrand = (raw) => {
    const text = String(raw || '').trim();
    if (!text) return null;
    if (/\s/.test(text)) return text;

    const withoutTld = text.replace(/\.(com|co\.uk|co|net|org|shop|store|us|io)$/i, '');
    const words = withoutTld.split(/[-_.]+/).filter(Boolean);
    // The first word survives whatever it is, so a brand actually called
    // "Shop" does not vanish entirely.
    const kept = words.filter((w, i) => i === 0 || !REGIONAL.test(w));
    const cleaned = (kept.length ? kept : words).join(' ').trim();

    return cleaned ? cleaned.replace(/\b[a-z]/g, (c) => c.toUpperCase()) : text;
};

/**
 * Parse a product page. Separated from the fetch so it can be tested against
 * fixtures. Always returns something — a page with only an og:title still
 * yields a usable row — and reports how much it actually found.
 */
export function parseProductHtml(html, sourceUrl) {
    const url = new URL(sourceUrl);
    const product = jsonLdBlocks(html).map((b) => findByType(b, ['Product', 'ProductGroup'])).find(Boolean);

    const offer = product ? readOffer(product.offers) : {};

    // Meta-tag fallbacks. Shopify, WooCommerce and most storefronts emit
    // product:price:amount even when their JSON-LD is absent or broken.
    const metaPriceRaw = firstMeta(html, [
        'product:price:amount', 'og:price:amount', 'twitter:data1', 'price',
    ]);
    const metaCurrency = firstMeta(html, ['product:price:currency', 'og:price:currency']);

    const amount = offer.amount ?? parsePrice(metaPriceRaw);
    const currency = offer.currency || guessCurrency(metaPriceRaw, metaCurrency);

    const realTitle =
        (product && product.name && decode(product.name))
        || firstMeta(html, ['og:title', 'twitter:title'])
        || decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1])
        || null;

    // A hostname is not a product name. Big retailers behind bot protection
    // serve a challenge page that parses fine and says nothing, and calling the
    // result "www.lecreuset.com" is worse than admitting we could not read it.
    const title = realTitle || url.hostname;

    const description =
        (product && product.description && decode(product.description))
        || firstMeta(html, ['og:description', 'twitter:description', 'description'])
        || null;

    const image =
        (product && firstImage(product.image))
        || firstMeta(html, ['og:image', 'twitter:image', 'twitter:image:src'])
        || null;

    // Structured brand first, then an explicit brand meta tag, then the site's
    // own name, then the domain — each needing more cleanup than the last.
    const brand =
        (product && brandName(product.brand))
        || (product && brandName(product.manufacturer))
        || firstMeta(html, ['product:brand', 'og:brand'])
        || tidyBrand(firstMeta(html, ['og:site_name']))
        || tidyBrand(url.hostname.replace(/^www\./, ''));

    return {
        title,
        description: description ? description.slice(0, 1000) : null,
        image_url: image && /^https?:\/\//i.test(image) ? image : null,
        brand,
        price_amount: amount,
        price_currency: amount !== null ? (currency || 'USD') : null,
        in_stock: offer.inStock ?? null,
        link: url.toString(),
        // What the caller should tell her. A page with structured product data
        // is trustworthy; an og:title-only page is a best guess.
        structured: Boolean(product),
        // True when nothing on the page named the product, so the caller knows
        // to keep whatever name it already had.
        title_fallback: !realTitle,
        found: [
            realTitle ? 'name' : null,
            amount !== null ? 'price' : null,
            image ? 'image' : null,
            description ? 'description' : null,
        ].filter(Boolean),
        // One usable field is a fluke — an og:title on a cookie wall. Two, or
        // any structured product data, means the page genuinely told us
        // something.
        usable: Boolean(product) || [realTitle, amount !== null, image, description].filter(Boolean).length >= 2,
    };
}

/** Fetch and parse in one step. */
export async function extractProduct(link) {
    const { html, url } = await fetchHtml(link);
    return parseProductHtml(html, url);
}
