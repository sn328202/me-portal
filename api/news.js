// Allowed NewsAPI endpoints. The value arrives from the /api/news/(.*) rewrite,
// so it must never be interpolated into the target URL unchecked.
const ALLOWED_ENDPOINTS = ['top-headlines', 'everything'];

export default async function handler(request, response) {
    // Same-origin only: the app calls this from its own origin, so we never
    // hand out a wildcard and we never allow credentialed cross-site calls.
    const forwardedProto = request.headers['x-forwarded-proto'];
    const proto = (forwardedProto ? String(forwardedProto).split(',')[0].trim() : 'https');
    const selfOrigin = `${proto}://${request.headers.host}`;
    const origin = request.headers.origin;

    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');

    if (origin) {
        if (origin !== selfOrigin) {
            return response.status(403).json({ error: 'Cross-origin requests are not allowed' });
        }
        response.setHeader('Access-Control-Allow-Origin', selfOrigin);
    }

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    // Fix: internal URL might be relative, so we provide a base
    const { searchParams } = new URL(request.url, `http://${request.headers.host}`);
    const endpoint = searchParams.get('endpoint') || 'top-headlines';
    const q = searchParams.get('q');
    const sources = searchParams.get('sources');
    const apiKey = searchParams.get('apiKey');

    if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
        return response.status(400).json({ error: 'Unsupported endpoint' });
    }

    if (!apiKey) {
        return response.status(400).json({ error: 'API Key required' });
    }

    // Construct target URL. The key goes in a request header, not the query
    // string, so it stays out of access logs and Referer headers.
    const baseUrl = 'https://newsapi.org/v2';
    let query = '';

    if (sources) {
        // NewsAPI expects sources as a comma-separated string
        query = `sources=${encodeURIComponent(sources)}`;
    } else if (q) {
        query = `q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt`;
    }

    const targetUrl = `${baseUrl}/${endpoint}${query ? `?${query}` : ''}`;

    try {
        const res = await fetch(targetUrl, {
            headers: { 'X-Api-Key': apiKey }
        });
        if (!res.ok) {
            const text = await res.text();
            return response.status(res.status).json({ error: `NewsAPI Error: ${res.statusText}`, details: text });
        }
        const data = await res.json();
        return response.status(200).json(data);
    } catch (error) {
        return response.status(500).json({ error: 'Proxy Server Error', details: error.message });
    }
}
