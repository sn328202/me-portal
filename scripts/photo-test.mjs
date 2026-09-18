/**
 * Photographs on their way in.
 *
 * Every check here exists because the alternative is a photograph of a recipe
 * silently becoming nothing. Her first attempt at this was exactly that: the
 * Shortcut sent the string "IMG_1628" — the file's *name* — and the capture
 * dutifully filed a note saying there was nothing to file.
 */

import {
    readPhoto, readPhotos, sniff, photoPath, asContent, photoPreamble,
    MAX_PHOTOS, MAX_ONE, MAX_ALL,
} from '../api/_photo.js';

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

/* Real first bytes, so the sniffing is tested against what a camera actually
   produces rather than against a string I chose to make it pass. */
const JPEG = '/9j/4AAQSkZJRgABAQEAYABgAAD';
const PNG = 'iVBORw0KGgoAAAANSUhEUg';
const WEBP = 'UklGRiQAAABXRUJQVlA4';
const GIF = 'R0lGODlhAQABAAAAACw=';
// An iPhone's default. The box says "ftypheic" and no vision model reads it.
const HEIC = 'AAAAGGZ0eXBoZWljAAAAAG1pZjE=';

console.log('\nwhat kind of picture is this:');
check('a JPEG knows itself', sniff(JPEG)?.media_type, 'image/jpeg');
check('and a PNG', sniff(PNG)?.media_type, 'image/png');
check('and a WebP', sniff(WEBP)?.media_type, 'image/webp');
check('and a GIF', sniff(GIF)?.media_type, 'image/gif');
check('a HEIC is not one of them', sniff(HEIC), null);

console.log('\none photograph:');
check('a plain JPEG comes through',
    readPhoto(JPEG).photo.media_type, 'image/jpeg');
// A browser adds the data: wrapper; Shortcuts does not. Both must work.
check('so does one wearing a data: wrapper',
    readPhoto(`data:image/jpeg;base64,${JPEG}`).photo.data, JPEG);
/* Shortcuts' Base64 Encode has a "line breaks" setting that is ON by default.
   The result is perfectly valid base64 with a newline every 76 characters, and
   refusing it would be refusing the default. */
check('and one broken into lines the way Shortcuts writes it',
    readPhoto(`${JPEG.slice(0, 10)}\n${JPEG.slice(10)}`).photo.data, JPEG);

/* The failure she actually hit. The message has to name the fix, because
   "could not read that" sends you looking at the photograph rather than at the
   Shortcut, which is where the problem is. */
check('a filename is refused, and says what went wrong',
    readPhoto('IMG_1628'), { ok: false, why: 'it is not base64 — send the image itself, not its name' });
check('a HEIC is refused, and says to convert it',
    readPhoto(HEIC).why.includes('HEIC has to be converted'), true);
check('nothing at all is refused', readPhoto('').ok, false);
check('and so is undefined', readPhoto(undefined).ok, false);
check('a photograph too big to survive the trip is refused',
    readPhoto(JPEG + 'A'.repeat(MAX_ONE)).why.includes('resize'), true);

console.log('\na handful of them:');
{
    const { photos, problems } = readPhotos({ images: [JPEG, PNG] });
    // Order is the whole point: page one is the ingredients and page two is
    // the method, and the other way round is a different, worse recipe.
    check('two arrive in the order they were sent',
        photos.map((p) => p.media_type), ['image/jpeg', 'image/png']);
    check('and nothing is wrong with them', problems, []);
}
check('a single `image` works as well as a list',
    readPhotos({ image: JPEG }).photos.length, 1);
check('no photographs is no photographs, not a crash',
    readPhotos({}), { photos: [], problems: [] });
check('and neither is a body that is not there',
    readPhotos(undefined), { photos: [], problems: [] });
{
    /* One bad photograph among three files the two good ones. Refusing all
       three would lose a recipe over a page that did not upload. */
    const { photos, problems } = readPhotos({ images: [JPEG, 'IMG_1629', PNG] });
    check('a bad one is dropped, not fatal', photos.length, 2);
    check('and it is named by position', problems.length === 1 && problems[0].startsWith('photo 2:'), true);
}
{
    const many = Array.from({ length: MAX_PHOTOS + 2 }, () => JPEG);
    const { photos, problems } = readPhotos({ images: many });
    check(`more than ${MAX_PHOTOS} is more than one thing`, photos.length, MAX_PHOTOS);
    check('and the extras are reported', problems.length, 2);
}
{
    /* Individually fine, together past what a request body will carry. Sized
       so exactly two fit and the third does not, rather than left to whatever
       the constants happen to be — getting this arithmetic wrong is how the
       total cap came to be set above the body limit it exists to respect. */
    const each = Math.floor(MAX_ALL / 2) - 10;
    const big = JPEG + 'A'.repeat(each - JPEG.length);
    check('the fixture is two-and-a-bit, by construction',
        [each * 2 <= MAX_ALL, each * 3 > MAX_ALL, each <= MAX_ONE], [true, true, true]);

    const { photos, problems } = readPhotos({ images: [big, big, big] });
    check('two fit and the third is turned away', photos.length, 2);
    check('and it says they are too large together',
        problems[0].includes('together they are too large'), true);
    /* The whole point of the total cap: a serverless request body stops at
       about 4.5MB, and base64 sits in it one character to the byte. A cap set
       above that is not a cap. */
    check('the total stays under what a request body will carry',
        MAX_ALL <= 4_500_000, true);
    check('and one photograph alone can still be a big one',
        MAX_ONE < MAX_ALL && MAX_ONE > 2_000_000, true);
}

console.log('\nwhere it is kept:');
/* Under the user id so one person's pictures are one prefix; a random middle
   so the address cannot be guessed, which is what a public bucket rests on. */
check('user, then capture, then which one',
    photoPath('u-1', 'cap-9', 0, 'jpg'), 'u-1/cap-9/1.jpg');
check('the second one is the second one',
    photoPath('u-1', 'cap-9', 1, 'png'), 'u-1/cap-9/2.png');

console.log('\nwhat the model is handed:');
{
    const blocks = asContent([{ media_type: 'image/jpeg', data: JPEG }], 'from mum');
    check('pictures first, words after', blocks.map((b) => b.type), ['image', 'text']);
    check('as base64, labelled with what it really is',
        [blocks[0].source.type, blocks[0].source.media_type], ['base64', 'image/jpeg']);
    check('and her words are kept verbatim', blocks[1].text, 'from mum');
}
check('no words is no empty text block',
    asContent([{ media_type: 'image/png', data: PNG }]).length, 1);

console.log('\nwhat it is told they are:');
/* The single most likely way this goes wrong is a two-page spread read as two
   recipes, so the count and the word ONE are said out loud. */
check('two pages are one thing, and it says so',
    photoPreamble(2, '').includes('They are ONE thing between them'), true);
check('and it says how many, so it cannot file three',
    photoPreamble(2, '').includes('not 2'), true);
check('one photograph is told plainly what it is',
    photoPreamble(1, '').startsWith('She sent a photograph'), true);
check('a recipe is named as the likeliest, with what to take off the page',
    photoPreamble(1, '').includes('every ingredient with its amount'), true);
check('and the other rooms are named too',
    photoPreamble(1, '').includes('wine label') && photoPreamble(1, '').includes('Library'), true);
// Reading what is not printed is the one thing worse than reading nothing.
check('it is told not to invent what it cannot read',
    photoPreamble(1, '').includes('Do not invent an ingredient that is not there'), true);
check('her words ride along', photoPreamble(1, 'mum’s dal').includes('She also said: mum’s dal'), true);
check('and no photographs leaves the words exactly as they were',
    photoPreamble(0, 'just a note'), 'just a note');

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
