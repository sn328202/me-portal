/**
 * GET /api/fx?from=INR&date=2026-10-01
 *
 * USD per one unit of `from` on `date` (or the latest rate when the date is in
 * the future or missing), from Frankfurter's free public rates. Returns
 * { ok, rate, date, source }. No key, nothing stored here; the caller saves
 * the rate on the cost it is for.
 */

const today = () => new Date().toISOString().slice(0, 10);

export const parseRate = (json) => {
    if (!json || typeof json !== 'object') return null;
    const direct = Number(json.rate);
    if (direct > 0) return direct;
    const nested = Number(json.rates?.USD);
    if (nested > 0) return nested;
    if (Array.isArray(json) && json.length) return parseRate(json[0]);
    return null;
};

const tryFetch = async (url) => {
    try {
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) return null;
        const json = await r.json();
        const rate = parseRate(json);
        return rate ? { rate, date: json.date || json[0]?.date || null } : null;
    } catch {
        return null;
    }
};

export default async function handler(req, res) {
    const from = String(req.query?.from || '').trim().toUpperCase();
    const asked = String(req.query?.date || '').trim();
    if (!/^[A-Z]{3}$/.test(from)) return res.status(400).json({ ok: false, error: 'Give a three-letter currency.' });
    if (from === 'USD') return res.status(200).json({ ok: true, rate: 1, date: asked || today(), source: 'same currency' });

    const date = /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today() ? asked : null;
    const lower = from.toLowerCase();

    const found = (date
        ? await tryFetch(`https://api.frankfurter.dev/v2/rate/${lower}/usd?date=${date}`)
            || await tryFetch(`https://api.frankfurter.dev/v1/${date}?base=${from}&symbols=USD`)
        : null)
        || await tryFetch(`https://api.frankfurter.dev/v2/rate/${lower}/usd`)
        || await tryFetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=USD`);

    if (!found) return res.status(502).json({ ok: false, error: `No rate found for ${from}. Type the USD amount instead.` });

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({
        ok: true,
        rate: found.rate,
        date: found.date || date || today(),
        source: date ? 'rate on that date' : 'latest rate',
    });
}
