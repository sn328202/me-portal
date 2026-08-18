export default async function handler(request, response) {
    // Enable CORS
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    // Fix: internal URL might be relative, so we provide a base
    const { searchParams } = new URL(request.url, `http://${request.headers.host}`);
    const endpoint = searchParams.get('endpoint') || 'top-headlines';
    const q = searchParams.get('q');
    const sources = searchParams.get('sources');
    const apiKey = searchParams.get('apiKey');

    if (!apiKey) {
        return response.status(400).json({ error: 'API Key required' });
    }

    // Construct target URL
    const baseUrl = 'https://newsapi.org/v2';
    let targetUrl = `${baseUrl}/${endpoint}?apiKey=${apiKey}`;

    if (sources) {
        // NewsAPI expects sources as a comma-separated string
        targetUrl += `&sources=${sources}`;
    } else if (q) {
        targetUrl += `&q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt`;
    }

    try {
        const res = await fetch(targetUrl);
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
