/**
 * Reading a weather answer, whatever kind it is.
 *
 * A trip three days out gets a real forecast. A trip in December gets an
 * average of what the last ten Decembers actually did at that spot. Those are
 * very different claims and the UI has to say which one it is showing — a
 * "72°" that is really "72° on average, give or take" is worse than no number,
 * because it will be packed for.
 *
 * WMO codes are the standard Open-Meteo speaks. The mapping is here rather
 * than on the server so the client can re-label cached rows without a fetch.
 */

/** WMO 4677 weather codes, grouped to the distinctions worth packing for. */
const CODES = [
    [[0], 'Clear', '☀️'],
    [[1], 'Mostly clear', '🌤️'],
    [[2], 'Partly cloudy', '⛅'],
    [[3], 'Overcast', '☁️'],
    [[45, 48], 'Fog', '🌫️'],
    [[51, 53, 55, 56, 57], 'Drizzle', '🌦️'],
    [[61, 63, 80, 81], 'Rain', '🌧️'],
    [[65, 82], 'Heavy rain', '⛈️'],
    [[66, 67], 'Freezing rain', '🌧️'],
    [[71, 73, 75, 77, 85, 86], 'Snow', '🌨️'],
    [[95, 96, 99], 'Thunderstorms', '⛈️'],
];

export const describeCode = (code) => {
    const hit = CODES.find(([codes]) => codes.includes(Number(code)));
    return hit ? { label: hit[1], icon: hit[2] } : { label: '—', icon: '·' };
};

/**
 * What to wear, from the temperature.
 *
 * The sheet had a "Dress Code" column filled in by hand next to the weather.
 * This is that column, derived — it is a blunt rule and deliberately so; the
 * point is a nudge while packing, not a styling opinion.
 */
export const dressFor = (high, low) => {
    // Number(null) and Number('') are both 0, which is finite - so a missing
    // temperature would sail through and confidently advise packing for
    // freezing. Reject absence before converting.
    if (high === null || high === undefined || high === '') return null;
    const h = Number(high);
    const l = (low === null || low === undefined || low === '') ? NaN : Number(low);
    if (!Number.isFinite(h)) return null;
    const swing = Number.isFinite(l) ? h - l : 0;

    let base;
    if (h >= 85) base = 'Hot — lightest things you own';
    else if (h >= 75) base = 'Warm — short sleeves';
    else if (h >= 63) base = 'Mild — long sleeves';
    else if (h >= 50) base = 'Cool — a jacket';
    else if (h >= 38) base = 'Cold — a proper coat';
    else base = 'Freezing — coat, hat, gloves';

    // A wide daily swing is the thing people actually get wrong: dressed for
    // the afternoon high and caught out at breakfast.
    return swing >= 25 ? `${base}, and layers — it drops ${Math.round(swing)}° overnight` : base;
};

/** True when a date is close enough that a real forecast exists for it. */
export const isForecastable = (isoDate, today = new Date()) => {
    const target = new Date(`${isoDate}T12:00:00`);
    if (Number.isNaN(target.getTime())) return false;
    const days = Math.floor((target - today) / 86400000);
    return days >= -1 && days <= 15;
};

/** How to caption a weather figure so its confidence is not overstated. */
export const sourceLabel = (weather) => {
    if (!weather) return null;
    if (weather.source === 'forecast') return 'forecast';
    if (weather.source === 'normal') {
        const n = weather.years || 10;
        return `typical for these dates (${n}-year average)`;
    }
    return null;
};
