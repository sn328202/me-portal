/**
 * GET /api/place-photo?ref=places/XXX/photos/YYY
 *
 * Google's photo media URL requires the API key in the query string. That URL
 * would be rendered in the browser and therefore public, so the key stays here
 * and the image is fetched through this endpoint instead.
 */

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
    const ref = (req.query?.ref || '').toString();
    const key = process.env.GOOGLE_PLACES_API_KEY;

    if (!key) return res.status(404).end();
    // Only ever a Places photo resource name — never an arbitrary URL.
    if (!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(ref)) {
        return res.status(400).json({ error: 'Not a photo reference.' });
    }

    try {
        const upstream = await fetch(
            `https://places.googleapis.com/v1/${ref}/media?maxHeightPx=800&key=${encodeURIComponent(key)}`,
            { redirect: 'follow', signal: AbortSignal.timeout(10000) }
        );
        if (!upstream.ok) return res.status(upstream.status).end();

        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
        // Place photos do not change; let the browser and the CDN keep them.
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable');
        return res.status(200).send(Buffer.from(await upstream.arrayBuffer()));
    } catch {
        return res.status(502).end();
    }
}
