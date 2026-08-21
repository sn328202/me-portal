/**
 * Me Portal service worker.
 *
 * Deliberately conservative. A service worker that caches too eagerly is worse
 * than none at all: it serves a stale index.html referencing asset hashes that
 * no longer exist, and the app appears to break in a way a refresh cannot fix.
 *
 * The rules:
 *   navigations  -> network first, cached shell only when the network fails
 *   /assets/*    -> cache first; Vite fingerprints these, so a given URL's
 *                   content never changes
 *   icons, fonts -> stale-while-revalidate
 *   everything else (API, Supabase, Google) -> straight to the network,
 *                   never cached
 *
 * It does not call skipWaiting. A new version takes over on the next launch
 * rather than swapping code under a page that is mid-render.
 */

const VERSION = 'v1';
const SHELL = `me-portal-shell-${VERSION}`;
const ASSETS = `me-portal-assets-${VERSION}`;
const MEDIA = `me-portal-media-${VERSION}`;
const KEEP = [SHELL, ASSETS, MEDIA];

const SHELL_URLS = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {
            // A failed precache must not block installation — the app still
            // works, it just will not open offline until the next visit.
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n)));
        await self.clients.claim();
    })());
});

const networkFirst = async (request) => {
    try {
        const fresh = await fetch(request);
        if (fresh.ok) {
            const cache = await caches.open(SHELL);
            cache.put('/', fresh.clone());
        }
        return fresh;
    } catch {
        // Offline, or a dead connection. The cached shell boots the app, which
        // then shows its own error states for whatever data it cannot reach.
        return (await caches.match('/')) || Response.error();
    }
};

const cacheFirst = async (request, cacheName) => {
    const hit = await caches.match(request);
    if (hit) return hit;
    const fresh = await fetch(request);
    if (fresh.ok) {
        const cache = await caches.open(cacheName);
        cache.put(request, fresh.clone());
    }
    return fresh;
};

const staleWhileRevalidate = async (request, cacheName) => {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(request);
    const network = fetch(request).then((fresh) => {
        if (fresh.ok) cache.put(request, fresh.clone());
        return fresh;
    }).catch(() => hit);
    return hit || network;
};

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Never come between the app and its data.
    if (url.pathname.startsWith('/api/')) return;
    if (url.hostname.endsWith('.supabase.co')) return;
    if (url.hostname.endsWith('googleapis.com') && !url.hostname.startsWith('fonts')) return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request));
        return;
    }

    if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
        event.respondWith(cacheFirst(request, ASSETS));
        return;
    }

    if (
        (url.origin === self.location.origin && /\.(png|svg|ico|webmanifest)$/.test(url.pathname))
        || url.hostname === 'fonts.googleapis.com'
        || url.hostname === 'fonts.gstatic.com'
    ) {
        event.respondWith(staleWhileRevalidate(request, MEDIA));
    }
});

// An escape hatch: if a release ever ships a broken worker, the page can tell
// it to clear everything and unregister rather than needing the user to dig
// through browser settings.
self.addEventListener('message', (event) => {
    if (event.data === 'purge') {
        event.waitUntil((async () => {
            const names = await caches.keys();
            await Promise.all(names.map((n) => caches.delete(n)));
            await self.registration.unregister();
        })());
    }
});
