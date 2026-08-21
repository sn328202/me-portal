/**
 * Unit checks for post reading. The network half is exercised live in
 * scripts/social-live.mjs; this pins the pure logic, which is where the
 * embarrassing mistakes live — calling a 200-character TikTok caption a
 * "title", or silently treating Instagram as merely broken.
 */
import { platformOf, shorten, UNREADABLE, readPost } from '../api/_social.js';

let failed = 0;
const check = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failed += 1;
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${ok ? '' : `\n         got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`}`);
};

console.log('\nplatformOf():');
check('tiktok', platformOf('https://www.tiktok.com/@x/video/123'), 'tiktok');
check('tiktok short link', platformOf('https://vm.tiktok.com/ZMabc/'), 'tiktok');
check('youtube', platformOf('https://www.youtube.com/watch?v=abc'), 'youtube');
check('youtu.be', platformOf('https://youtu.be/abc'), 'youtube');
check('instagram', platformOf('https://www.instagram.com/p/abc/'), 'instagram');
check('a recipe blog is just web', platformOf('https://cooking.nytimes.com/recipes/1'), 'web');
check('not a url at all', platformOf('hello'), null);
// The regexes are anchored so a lookalike domain cannot impersonate a platform.
check('lookalike domain is not tiktok', platformOf('https://tiktok.com.evil.example/x'), 'web');

console.log('\nshorten() — a caption is not a title:');
check('short caption passes through', shorten('Miso butter pasta'), 'Miso butter pasta');
check('cuts at the first hashtag',
    shorten('Miso butter pasta #recipe #easydinner #fyp'), 'Miso butter pasta');
check('cuts at a newline', shorten('Miso butter pasta\nyou will need:'), 'Miso butter pasta');
check('truncates on a word boundary',
    shorten('The single best weeknight pasta you will ever make and it takes twelve minutes flat', 40),
    'The single best weeknight pasta you will…');
check('nothing in, nothing out', shorten(''), null);

console.log('\nreadPost() — the ones that refuse:');
for (const platform of Object.keys(UNREADABLE)) {
    const url = `https://www.${platform}.com/p/abc/`;
    const result = await readPost(url);
    check(`${platform} reports why rather than failing`,
        { readable: result.readable, hasReason: Boolean(result.problem) },
        { readable: false, hasReason: true });
}
{
    const result = await readPost('not a url');
    check('junk is refused cleanly', result.readable, false);
}

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
