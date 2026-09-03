/**
 * Share links: the token, and the address it turns into.
 *
 * Kept out of the component so the one thing that matters — that a token is
 * unguessable and that a revoked one is dead — can be tested without a
 * browser or a database.
 */

/** 32 random bytes as base64url: 43 characters, no padding, URL-safe. */
export const makeToken = (random = globalThis.crypto) => {
    const bytes = new Uint8Array(32);
    random.getRandomValues(bytes);
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/* What the server will accept. Kept here as well so a token that could never
   work is never handed to anyone. */
export const isToken = (t) => typeof t === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(t);

/** The address to send someone. */
export const shareUrl = (token, origin = '') => `${origin}/t/${token}`;

/**
 * A link is live only while it has not been revoked.
 *
 * Deleting the row would work too, and would lose the answer to "did anyone
 * ever open the one I sent Mayur". Revoking keeps the record and kills the
 * access, which is the pair you want.
 */
export const isLive = (share) => Boolean(share) && !share.revoked_at;

/** Live links first, then the most recently made. */
export const sortShares = (shares = []) =>
    [...shares].sort((a, b) => {
        const live = Number(isLive(b)) - Number(isLive(a));
        if (live) return live;
        return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });

/** "Nobody yet" reads better than "0 views" on a link made ten seconds ago. */
export const describeViews = (share) => {
    const n = Number(share?.views) || 0;
    if (!n) return 'not opened yet';
    return n === 1 ? 'opened once' : `opened ${n} times`;
};
