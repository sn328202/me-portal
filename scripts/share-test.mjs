/**
 * Share links.
 *
 * The token is the whole security model of a public link, so the tests that
 * matter here are about it being unguessable and about a revoked link being
 * properly dead rather than merely hidden.
 */
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');

const { makeToken, isToken, shareUrl, isLive, sortShares, describeViews } =
    await import('../src/utils/shareLink.js');

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log(`  ok  ${name}`); };

t('a token is 43 URL-safe characters', () => {
    const tok = makeToken(webcrypto);
    assert.equal(tok.length, 43);
    assert.match(tok, /^[A-Za-z0-9_-]+$/);
});

t('and it is never the same twice', () => {
    // 256 bits. A thousand draws colliding would mean the generator is broken,
    // which is the only thing this can actually catch — and the only thing
    // worth catching, because a predictable token is the whole trip.
    const seen = new Set();
    for (let i = 0; i < 1000; i += 1) seen.add(makeToken(webcrypto));
    assert.equal(seen.size, 1000);
});

t('what the server accepts is what we make', () => {
    assert.ok(isToken(makeToken(webcrypto)));
});

t('and it refuses anything that could not be one', () => {
    // A trip id is the shape of thing somebody would try first.
    assert.equal(isToken('7'), false);
    assert.equal(isToken(''), false);
    assert.equal(isToken(null), false);
    assert.equal(isToken('a'.repeat(31)), false, '31 chars is under the floor');
    assert.equal(isToken('a'.repeat(129)), false, 'and 129 is over the ceiling');
    assert.equal(isToken(`${'a'.repeat(40)}/../x`), false, 'no path tricks');
    assert.equal(isToken(`${'a'.repeat(40)}?x=1`), false, 'no query tricks');
});

t('the address is the token on this origin', () => {
    assert.equal(shareUrl('abc', 'https://me-portal-xi.vercel.app'),
        'https://me-portal-xi.vercel.app/t/abc');
});

t('a revoked link is dead, not merely quiet', () => {
    assert.equal(isLive({ token: 'x' }), true);
    assert.equal(isLive({ token: 'x', revoked_at: '2026-09-03T00:00:00Z' }), false);
    assert.equal(isLive(null), false);
});

t('live links come first, then the newest', () => {
    const rows = [
        { token: 'old', created_at: '2026-01-01' },
        { token: 'dead', created_at: '2026-09-01', revoked_at: '2026-09-02' },
        { token: 'new', created_at: '2026-08-01' },
    ];
    assert.deepEqual(sortShares(rows).map((r) => r.token), ['new', 'old', 'dead']);
});

t('and sorting does not disturb the list it was given', () => {
    const rows = [{ token: 'a', created_at: '1' }, { token: 'b', created_at: '2' }];
    sortShares(rows);
    assert.deepEqual(rows.map((r) => r.token), ['a', 'b']);
});

t('a link nobody has opened says so', () => {
    assert.equal(describeViews({ views: 0 }), 'not opened yet');
    assert.equal(describeViews({}), 'not opened yet');
    assert.equal(describeViews({ views: 1 }), 'opened once');
    assert.equal(describeViews({ views: 9 }), 'opened 9 times');
});

console.log(`\nshareLink: ${n} passed`);
