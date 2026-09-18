/**
 * A picture chosen in the browser, on its way to the capture endpoint.
 *
 * The phone sends base64 because Shortcuts speaks base64. The desktop has a
 * File, so it has to arrive at the same shape — and small enough to survive
 * the trip, which a photograph straight off a camera is not. A 12-megapixel
 * iPhone shot is three to five megabytes; the request body stops at about
 * four and a half for everything together.
 *
 * So it is shrunk here rather than refused here. The Shortcut was told to
 * resize to 1600px from the first version of this feature; the browser was
 * not, and the first real photograph anybody took came back "too big" — which
 * is a limit reported instead of a problem solved.
 *
 * 1600px on the long edge is plenty to read a cookbook page by, and it takes
 * a four-megabyte photograph down to about four hundred kilobytes.
 */

/* `_photoLimits`, never `_photo` — that one builds a Buffer at module scope,
   and importing it here for three numbers put `Buffer.from` on the first line
   the browser ran. */
import { MAX_PHOTOS, MAX_ONE, MAX_ALL } from '../../api/_photoLimits.js';

export { MAX_PHOTOS };

/** The long edge everything is brought down to, and what it is encoded at. */
export const MAX_EDGE = 1600;
const QUALITY = 0.82;
/* How far quality is allowed to fall before we admit defeat. Below about 0.4
   a photograph of text starts losing the text, which is the one thing it is
   here for. */
const FLOOR = 0.4;

/* `image/*` rather than a list of types, deliberately: on iOS it offers the
   camera as well as the library, and Safari hands over a JPEG instead of a
   HEIC when the accept list is not specific. */
export const ACCEPT = 'image/*';

/** The base64 payload of a data URL, which is what the size limits count. */
export const base64Length = (dataUrl) => {
    const at = String(dataUrl || '').indexOf(',');
    return at < 0 ? 0 : dataUrl.length - at - 1;
};

/** Which of these files are worth trying, and what to say about the rest. */
export const pickPhotos = (files = [], already = 0) => {
    const take = [];
    const problems = [];

    for (const file of Array.from(files)) {
        if (already + take.length >= MAX_PHOTOS) {
            problems.push(`${MAX_PHOTOS} photos at a time is the limit`);
            break;
        }
        /* Size is not checked here any more. It is checked after shrinking,
           because the whole point is that a photograph too big to send is
           still a photograph worth sending once it is smaller. */
        if (file.type && !file.type.startsWith('image/')) {
            problems.push(`${file.name}: not an image`);
            continue;
        }
        take.push(file);
    }

    return { files: take, problems };
};

const loadImage = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    /* A HEIC on a browser that cannot decode it lands here. Safari can, and
       re-encoding through the canvas converts it on the way past, which is
       why iOS needs no conversion step of its own. */
    img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`${file.name}: this browser cannot read that image — export it as JPEG`));
    };
    img.src = url;
});

/**
 * One File, brought down to something that will fit, as a data URL.
 *
 * Quality steps down only if 1600px at 0.82 is somehow still too large — a
 * very wide panorama, mostly. Dimensions are not reduced further: a cookbook
 * page below about 1200px starts to lose its smaller print, and losing the
 * text is losing the photograph's only purpose.
 */
export const shrink = async (file) => {
    const img = await loadImage(file);
    const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1;
    const scale = Math.min(1, MAX_EDGE / longest);

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

    let out = canvas.toDataURL('image/jpeg', QUALITY);
    for (let q = QUALITY - 0.15; base64Length(out) > MAX_ONE && q >= FLOOR; q -= 0.15) {
        out = canvas.toDataURL('image/jpeg', q);
    }
    if (base64Length(out) > MAX_ONE) {
        throw new Error(`${file.name}: still too large after shrinking — try photographing one page`);
    }
    return out;
};

/**
 * Every chosen file, shrunk, and the ones that could not be.
 *
 * The total is checked as they accumulate rather than up front, because the
 * only honest measure of "will these fit" is what they weigh after shrinking.
 */
export const shrinkAll = async (files, alreadyEncoded = 0) => {
    const done = [];
    const problems = [];
    let total = alreadyEncoded;

    for (const file of files) {
        try {
            const data = await shrink(file);
            if (total + base64Length(data) > MAX_ALL) {
                problems.push(`${file.name}: too much altogether — send it on its own`);
                continue;
            }
            total += base64Length(data);
            done.push({ file, data });
        } catch (err) {
            problems.push(err.message);
        }
    }

    return { photos: done, problems };
};
