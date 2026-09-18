/**
 * Photographs, on their way to being filed.
 *
 * The Shortcut used to be able to say things and share links. Now it can point
 * a camera at a cookbook. Everything here is the part of that which does not
 * need a network: what arrived, whether it is really an image, whether it is
 * small enough to survive the trip, and where it will live afterwards.
 *
 * Pure on purpose. "Is this JPEG or PNG" and "is this too big" are exactly the
 * questions that are cheap to test and expensive to get wrong in production,
 * where the failure is a photo of a recipe silently becoming nothing.
 */

/* What Anthropic's vision will accept, keyed by the bytes a file starts with.
   The magic numbers are read from the base64 rather than trusted from the
   caller: Shortcuts will happily label a HEIC as a JPEG, and the model rejects
   the whole request when the label and the bytes disagree. */
const SIGNATURES = [
    { media_type: 'image/jpeg', prefix: '/9j/', ext: 'jpg' },
    { media_type: 'image/png', prefix: 'iVBORw0KGgo', ext: 'png' },
    { media_type: 'image/gif', prefix: 'R0lGOD', ext: 'gif' },
    { media_type: 'image/webp', prefix: 'UklGR', ext: 'webp' },
];

/** How many photographs one capture may carry. */
export const MAX_PHOTOS = 4;

/* The ceiling is not ours: a serverless request body is capped at about 4.5MB,
   and the base64 sits in that body one character to the byte — so the budget is
   ~4.5 million characters for everything, JSON and all. Four million leaves
   room for the rest of the request and for being wrong about the exact limit.
   A photograph that arrives truncated is worse than one refused, because a
   truncated one reads as a corrupt image and is reported as nothing to file.

   Base64 is four characters to every three bytes, so 2.6M characters is about
   a 1.9MB photograph — generous for one. A camera photo resized to 1600px is
   nearer 400KB, and four of those fit comfortably inside the total. */
export const MAX_ONE = 2_600_000;
export const MAX_ALL = 4_000_000;

/** The `data:` wrapper a browser adds, and Shortcuts does not. */
const unwrap = (value) => {
    const text = String(value || '').trim();
    const m = /^data:([a-z]+\/[a-z0-9.+-]+)?;base64,(.*)$/is.exec(text);
    return m ? m[2].trim() : text;
};

/* Whitespace is not an error: Shortcuts' Base64 Encode has a "line breaks"
   setting that is on by default, and the result is perfectly good base64 with
   a newline every 76 characters. */
const tidy = (value) => unwrap(value).replace(/\s+/g, '');

/** What this actually is, read from its first bytes. */
export const sniff = (data) => SIGNATURES.find((s) => data.startsWith(s.prefix)) || null;

/**
 * One photograph, or a reason it cannot be used.
 *
 * Returns `{ ok: true, photo }` or `{ ok: false, why }` rather than throwing,
 * because four photographs arriving where one is unreadable should file the
 * three and say so about the fourth.
 */
export const readPhoto = (value) => {
    const data = tidy(value);
    if (!data) return { ok: false, why: 'it was empty' };
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
        return { ok: false, why: 'it is not base64 — send the image itself, not its name' };
    }

    const kind = sniff(data);
    if (!kind) {
        /* Almost always HEIC, which is what an iPhone saves by default and
           which no vision model reads. The Shortcut has to convert, and the
           message has to say so, or the fix is unguessable. */
        return { ok: false, why: 'it is not a JPEG, PNG, GIF or WebP — an iPhone HEIC has to be converted first' };
    }
    if (data.length > MAX_ONE) {
        return { ok: false, why: 'it is too large — resize it to about 1600px in the Shortcut' };
    }
    return { ok: true, photo: { media_type: kind.media_type, ext: kind.ext, data } };
};

/**
 * Every photograph in the request, in the order they were sent.
 *
 * Order is the whole point when there is more than one: page one of a recipe
 * is the ingredients and page two is the method, and read the other way round
 * it is a different and much worse recipe.
 */
export const readPhotos = (body = {}) => {
    const given = []
        .concat(body.images ?? [])
        .concat(body.image ? [body.image] : [])
        .filter((v) => v !== null && v !== undefined && String(v).trim() !== '');

    const photos = [];
    const problems = [];
    let total = 0;

    for (const [i, value] of given.entries()) {
        if (photos.length >= MAX_PHOTOS) {
            problems.push(`photo ${i + 1}: more than ${MAX_PHOTOS} at once is more than one thing`);
            continue;
        }
        const read = readPhoto(value);
        if (!read.ok) {
            problems.push(`photo ${i + 1}: ${read.why}`);
            continue;
        }
        total += read.photo.data.length;
        if (total > MAX_ALL) {
            problems.push(`photo ${i + 1}: together they are too large — send fewer, or resize them`);
            continue;
        }
        photos.push(read.photo);
    }

    return { photos, problems };
};

/**
 * Where a photograph lives.
 *
 * Under the user id, so one person's pictures are one prefix and a future
 * policy can say so in a line. The random middle is what makes the address
 * unguessable, which is what a public bucket rests on.
 */
export const photoPath = (userId, id, index, ext) =>
    `${userId}/${id}/${index + 1}.${ext}`;

/** The blocks the model is handed: the pictures first, then the words. */
export const asContent = (photos = [], text = '') => {
    const blocks = photos.map((p) => ({
        type: 'image',
        source: { type: 'base64', media_type: p.media_type, data: p.data },
    }));
    if (text) blocks.push({ type: 'text', text });
    return blocks;
};

/**
 * What to tell the model it is looking at.
 *
 * Deliberately says how many and in what order. Without it a two-page spread
 * is read as two recipes, which is the single most likely way this goes wrong.
 */
export const photoPreamble = (count, text) => {
    if (!count) return text;
    const many = count > 1;
    return [
        many
            ? `She sent ${count} photographs. They are ONE thing between them, in order — a recipe spread across two pages, or the front and back of a label. Read them together and file one item, not ${count}.`
            : 'She sent a photograph. Read it and file what it is.',
        'It is most often a recipe: a cookbook page, a recipe card, a handwritten card, a screenshot. Take the title, every ingredient with its amount, the method, and the times and servings if they are printed.',
        'It may instead be a thing rather than a recipe — a wine label, a product, a book cover. Those go to the Treasury or the Library by what they are.',
        'Read what is printed. Do not invent an ingredient that is not there, and if part of the page is cut off or unreadable, file what you can read and say which part was missing.',
        text ? `She also said: ${text}` : null,
    ].filter(Boolean).join('\n\n');
};


/* ---------- getting a picture in without base64 ----------------------------
 *
 * Base64 inside JSON is what a Shortcut *can* do, and it is three actions and
 * a hand-built JSON body to do it. It is also how the first attempt failed:
 * an image variable dropped into a text field stringifies to its filename, so
 * the endpoint received the six characters "IMG_1628" and filed nothing.
 *
 * Shortcuts can post a file directly, and that is one action with nothing to
 * mistype. Two shapes arrive that way and both are read here.
 */

/** The image types we accept, as a content-type rather than as magic bytes. */
export const imageType = (contentType) => {
    const m = /^(image\/(?:jpeg|jpg|png|gif|webp))\b/i.exec(String(contentType || '').trim());
    if (!m) return null;
    // "image/jpg" is not a real media type, and the model rejects it.
    return m[1].toLowerCase().replace('image/jpg', 'image/jpeg');
};

/** The boundary out of a multipart content-type header. */
export const boundaryOf = (contentType) => {
    const m = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(String(contentType || ''));
    return m ? (m[1] || m[2]) : null;
};

const CRLF2 = Buffer.from('\r\n\r\n');

/**
 * A multipart body, split into its parts.
 *
 * Written rather than installed: the alternative was a dependency for forty
 * lines, and forty lines of boundary arithmetic is exactly the sort of thing
 * that is cheap to test and impossible to eyeball. Binary-safe throughout —
 * the parts are JPEG bytes, and a byte-for-byte slice is the whole job.
 */
export const parseMultipart = (buf, boundary) => {
    if (!Buffer.isBuffer(buf) || !boundary) return [];
    const sep = Buffer.from(`--${boundary}`);
    const parts = [];

    let at = buf.indexOf(sep);
    if (at < 0) return parts;
    at += sep.length;

    while (at < buf.length && parts.length < 32) {
        // "--" straight after a boundary is the end of the body.
        if (buf[at] === 0x2d && buf[at + 1] === 0x2d) break;
        if (buf[at] === 0x0d && buf[at + 1] === 0x0a) at += 2;

        const headEnd = buf.indexOf(CRLF2, at);
        if (headEnd < 0) break;
        const headers = buf.slice(at, headEnd).toString('utf8');
        const start = headEnd + CRLF2.length;

        let next = buf.indexOf(sep, start);
        if (next < 0) next = buf.length;
        // Every part's content is followed by a CRLF that belongs to the
        // boundary, not to the file. Keeping it corrupts the last two bytes.
        const end = Math.max(start, next - 2);

        const name = /name="([^"]*)"/i.exec(headers)?.[1] || '';
        const filename = /filename="([^"]*)"/i.exec(headers)?.[1] || null;
        const type = /content-type:\s*([^\r\n;]+)/i.exec(headers)?.[1]?.trim() || null;

        parts.push({ name, filename, type, data: buf.slice(start, end) });
        at = next + sep.length;
    }

    return parts;
};

/**
 * Whatever arrived, as the body the handler already knows how to read.
 *
 * Three ways in, and the two new ones are the ones a Shortcut can do in a
 * single action:
 *
 *   - `image/jpeg` and the raw file as the body. One action. Words, if there
 *     are any, ride in the `text` query parameter.
 *   - `multipart/form-data`, which is what "Request Body: Form" sends. Any
 *     field holding a file is a photograph; a field called text is her words.
 *   - `application/json`, which is what the web app and the old Shortcut send.
 */
export const bodyFrom = ({ contentType, raw, json, query = {} }) => {
    const ct = String(contentType || '');

    const direct = imageType(ct);
    if (direct && Buffer.isBuffer(raw) && raw.length) {
        return {
            text: String(query.text || '').trim(),
            source: query.source || 'shortcut',
            images: [`data:${direct};base64,${raw.toString('base64')}`],
        };
    }

    if (/^multipart\/form-data/i.test(ct) && Buffer.isBuffer(raw)) {
        const parts = parseMultipart(raw, boundaryOf(ct));
        const images = [];
        const fields = {};
        for (const part of parts) {
            const kind = imageType(part.type);
            if (kind && part.data.length) {
                images.push(`data:${kind};base64,${part.data.toString('base64')}`);
            } else if (part.name && !part.filename) {
                fields[part.name] = part.data.toString('utf8').trim();
            }
        }
        return {
            text: fields.text || String(query.text || '').trim(),
            url: fields.url || undefined,
            source: fields.source || query.source || 'shortcut',
            images,
        };
    }

    return json || {};
};
