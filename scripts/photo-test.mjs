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
    imageType, boundaryOf, parseMultipart, bodyFrom, sniffBytes,
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

console.log('\ngetting a picture in without base64:');
/* The first attempt failed because base64-into-JSON is three Shortcut actions
   and a hand-typed body, and an image variable dropped into a text field
   quietly becomes its own filename. Posting the file is one action. */
check('a JPEG body is a JPEG', imageType('image/jpeg'), 'image/jpeg');
check('and so is one with a charset stuck on it',
    imageType('image/png; charset=binary'), 'image/png');
/* Shortcuts says "image/jpg", which is not a real media type and which the
   model rejects outright. */
check('"image/jpg" is corrected, not refused', imageType('image/jpg'), 'image/jpeg');
check('a HEIC content-type is not one we take', imageType('image/heic'), null);
check('and neither is JSON', imageType('application/json'), null);
check('nor nothing at all', imageType(undefined), null);

check('a boundary is found', boundaryOf('multipart/form-data; boundary=abc123'), 'abc123');
check('and one in quotes', boundaryOf('multipart/form-data; boundary="a b c"'), 'a b c');
check('no boundary is null, not a crash', boundaryOf('multipart/form-data'), null);

console.log('\nbelieving the bytes when the label is unhelpful:');
/* Shortcuts will call a photograph `application/octet-stream` depending on
   where the image came from. Refusing it on the label is the same silent
   nothing this feature has already failed with twice. */
const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
const PNG_BYTES = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const WEBP_BYTES = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);
check('a JPEG is known by its bytes', sniffBytes(JPEG_BYTES), 'image/jpeg');
check('and a PNG', sniffBytes(PNG_BYTES), 'image/png');
check('and a WebP, which needs bytes 8 to 12 as well', sniffBytes(WEBP_BYTES), 'image/webp');
check('and a GIF', sniffBytes(Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(8)])), 'image/gif');
check('something that is not a picture is not one', sniffBytes(Buffer.from('{"text":"hello there"}')), null);
check('and nor is a buffer too short to tell', sniffBytes(Buffer.from([0xff, 0xd8])), null);
check('nor a string', sniffBytes('/9j/4AAQ'), null);

check('an octet-stream photograph is read anyway',
    bodyFrom({ contentType: 'application/octet-stream', raw: JPEG_BYTES }).images.length, 1);
check('and labelled by what it really is',
    bodyFrom({ contentType: 'application/octet-stream', raw: JPEG_BYTES })
        .images[0].startsWith('data:image/jpeg;base64,'), true);
/* But a JSON body is never sniffed at: it is text, it will not match, and
   trying would only make the JSON path harder to reason about. */
check('a JSON body is not mistaken for a picture',
    bodyFrom({ contentType: 'application/json', json: { text: 'hi' }, raw: Buffer.from('{"text":"hi"}') }),
    { text: 'hi' });

console.log('\nsplitting a form apart:');
{
    /* Built as real bytes, with a byte that is not valid UTF-8 inside the
       "file", because the parts are JPEG data and a parser that round-trips
       through a string corrupts every photograph it touches. */
    const B = 'X-BOUND-42';
    const bin = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x0d, 0x0a, 0x80, 0xfe]);
    const body = Buffer.concat([
        Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="text"\r\n\r\nmum's dal\r\n`),
        Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="photo"; filename="p.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
        bin,
        Buffer.from(`\r\n--${B}--\r\n`),
    ]);
    const parts = parseMultipart(body, B);
    check('both parts are found', parts.length, 2);
    check('a plain field keeps its name and value',
        [parts[0].name, parts[0].data.toString('utf8')], ['text', "mum's dal"]);
    check('a file keeps its name, filename and type',
        [parts[1].name, parts[1].filename, parts[1].type], ['photo', 'p.jpg', 'image/jpeg']);
    /* The two bytes before a boundary belong to the boundary, not to the file.
       Keeping them truncates nothing and corrupts the tail; dropping the wrong
       two truncates the image. Byte-for-byte or it is broken. */
    check('the file is byte-for-byte what went in',
        parts[1].data.equals(bin), true);
    check('including the CRLF that is inside it, not around it',
        [...parts[1].data], [...bin]);
}
check('a body with no boundary in it finds nothing',
    parseMultipart(Buffer.from('nothing here'), 'X'), []);
check('and a body that is not a buffer is not a crash', parseMultipart('str', 'X'), []);
check('nor is a missing boundary', parseMultipart(Buffer.from('x'), null), []);

console.log('\nwhichever way it arrived:');
{
    // One Shortcut action: post the file, content-type says what it is.
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const b = bodyFrom({ contentType: 'image/jpeg', raw: jpeg, query: { text: 'from mum' } });
    check('a raw image body becomes one photograph', b.images.length, 1);
    check('carried as a data url the reader already understands',
        b.images[0].startsWith('data:image/jpeg;base64,'), true);
    check('and it survives the trip', readPhotos(b).photos.length, 1);
    // Words ride in the query string, because a Shortcut can put them in a URL
    // far more easily than it can build a JSON body.
    check('her words come off the query string', b.text, 'from mum');
}
{
    const B = 'Y';
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const body = Buffer.concat([
        Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="text"\r\n\r\ntwo pages\r\n`),
        Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="a"; filename="1.png"\r\nContent-Type: image/png\r\n\r\n`),
        png,
        Buffer.from(`\r\n--${B}\r\nContent-Disposition: form-data; name="b"; filename="2.png"\r\nContent-Type: image/png\r\n\r\n`),
        png,
        Buffer.from(`\r\n--${B}--\r\n`),
    ]);
    const b = bodyFrom({ contentType: `multipart/form-data; boundary=${B}`, raw: body });
    check('a form gives up both photographs, in order', b.images.length, 2);
    check('and the field beside them', b.text, 'two pages');
    check('and they are readable', readPhotos(b).photos.length, 2);
}
// The web app and the old Shortcut still work exactly as they did.
check('JSON is left alone',
    bodyFrom({ contentType: 'application/json', json: { text: 'hi' } }), { text: 'hi' });
check('and so is a body that is nothing at all',
    bodyFrom({ contentType: 'application/json', json: null }), {});

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
