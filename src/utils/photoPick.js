/**
 * A picture chosen in the browser, on its way to the capture endpoint.
 *
 * The phone sends base64 because Shortcuts speaks base64. The desktop has a
 * File, so it has to arrive at the same shape — and the same rules about size
 * and type, applied here rather than after a round trip, because telling
 * somebody their photo was too big is much more use before the upload than
 * after it.
 */

/* `_photoLimits`, never `_photo` — that one builds a Buffer at module scope,
   and importing it here for three numbers put `Buffer.from` on the first line
   the browser ran. */
import { MAX_PHOTOS, MAX_ONE, MAX_ALL } from '../../api/_photoLimits.js';

export { MAX_PHOTOS };

/** What the file input and the drop zone will take. */
export const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';

const READABLE = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

/* Bytes to base64 characters: four out for every three in, rounded up to the
   next block of four. Worth computing rather than guessing, because "about a
   third bigger" is how a limit gets quietly exceeded. */
export const encodedLength = (bytes) => Math.ceil(bytes / 3) * 4;

/**
 * Which of these files can be sent, and what to say about the rest.
 *
 * Deliberately mirrors `readPhotos` on the server and shares its constants, so
 * a picture the browser accepts is never one the endpoint then refuses.
 */
export const pickPhotos = (files = [], already = 0) => {
    const take = [];
    const problems = [];
    let total = 0;

    for (const file of Array.from(files)) {
        if (already + take.length >= MAX_PHOTOS) {
            problems.push(`${MAX_PHOTOS} photos at a time is the limit`);
            break;
        }
        if (!READABLE.has(file.type)) {
            /* A HEIC dragged out of Photos is the common one. Safari will
               convert it on export; the message has to say so, or the fix is
               unguessable. */
            problems.push(`${file.name}: ${file.type === 'image/heic' || /\.heic$/i.test(file.name)
                ? 'iPhone HEIC — export it as JPEG first'
                : 'not a JPEG, PNG, GIF or WebP'}`);
            continue;
        }
        const encoded = encodedLength(file.size);
        if (encoded > MAX_ONE) {
            problems.push(`${file.name}: too big — about 2MB is the most one photo can be`);
            continue;
        }
        if (total + encoded > MAX_ALL) {
            problems.push(`${file.name}: too much altogether — send it on its own`);
            continue;
        }
        total += encoded;
        take.push(file);
    }

    return { files: take, problems };
};

/** One File as the base64 the endpoint expects, with its data: wrapper. */
export const asDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
});
