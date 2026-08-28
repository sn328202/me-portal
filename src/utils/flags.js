/**
 * A country as a flag.
 *
 * A trip needs something to look like at a glance, and most of hers will never
 * have a photo attached. The flags of the places it actually goes are free,
 * need no API, and say more than a coloured rectangle with the first letter of
 * the destination in it.
 *
 * The emoji itself is not a picture: a flag is two regional indicator symbols,
 * one per letter of the ISO country code, which the font pairs up. So "in"
 * becomes 🇮🇳 with no lookup table at all — the only table needed is the one
 * mapping the country *names* people type to their codes.
 */

/* Regional Indicator Symbol Letter A. */
const BASE = 0x1f1e6;

/** "in" -> 🇮🇳. Anything that is not two letters gets nothing. */
export const flagOf = (code) => {
    const letters = String(code || '').trim().toLowerCase();
    if (!/^[a-z]{2}$/.test(letters)) return '';
    return String.fromCodePoint(
        ...letters.split('').map((c) => BASE + c.charCodeAt(0) - 97)
    );
};

/**
 * The countries she is likely to type, and their codes.
 *
 * Deliberately small: it exists for the trips that were created before the
 * geocoder started recording a code, and for anything typed by hand. A country
 * that is not in it simply gets no flag, which is better than the wrong one.
 */
const BY_NAME = {
    india: 'in', 'united states': 'us', usa: 'us', us: 'us', america: 'us',
    'united kingdom': 'gb', uk: 'gb', england: 'gb', scotland: 'gb', wales: 'gb',
    ireland: 'ie', france: 'fr', spain: 'es', portugal: 'pt', italy: 'it',
    germany: 'de', switzerland: 'ch', austria: 'at', netherlands: 'nl',
    holland: 'nl', belgium: 'be', greece: 'gr', turkey: 'tr', türkiye: 'tr',
    croatia: 'hr', norway: 'no', sweden: 'se', denmark: 'dk', finland: 'fi',
    iceland: 'is', poland: 'pl', czechia: 'cz', 'czech republic': 'cz',
    hungary: 'hu', morocco: 'ma', egypt: 'eg', 'south africa': 'za',
    kenya: 'ke', tanzania: 'tz', japan: 'jp', china: 'cn', 'hong kong': 'hk',
    taiwan: 'tw', 'south korea': 'kr', korea: 'kr', thailand: 'th',
    vietnam: 'vn', cambodia: 'kh', laos: 'la', singapore: 'sg',
    malaysia: 'my', indonesia: 'id', philippines: 'ph', 'sri lanka': 'lk',
    nepal: 'np', bhutan: 'bt', maldives: 'mv', 'united arab emirates': 'ae',
    uae: 'ae', qatar: 'qa', jordan: 'jo', israel: 'il', australia: 'au',
    'new zealand': 'nz', canada: 'ca', mexico: 'mx', brazil: 'br',
    argentina: 'ar', chile: 'cl', peru: 'pe', colombia: 'co',
    'costa rica': 'cr', cuba: 'cu', jamaica: 'jm',
};

/** A country's code from whatever she wrote, or null. */
export const codeOf = (country) => {
    const text = String(country || '').trim().toLowerCase();
    if (!text) return null;
    // The table first, even for two-letter input: "UK" is what people write
    // and is not a country code — the flag lives at "gb".
    if (BY_NAME[text]) return BY_NAME[text];
    return /^[a-z]{2}$/.test(text) ? text : null;
};

/**
 * The flags for a trip, in the order it visits them, without repeats.
 *
 * A leg's stored code wins; its country name is the fallback for legs that
 * predate the geocoder. Travel legs have no country and contribute nothing,
 * which is right — "Air Travel" is not a place you need a flag for.
 */
export const flagsForLegs = (legs = []) => {
    const seen = [];
    for (const leg of legs) {
        const code = codeOf(leg?.country_code) || codeOf(leg?.country);
        if (code && !seen.includes(code)) seen.push(code);
    }
    return seen.map(flagOf).filter(Boolean);
};
