/**
 * How much photograph is allowed in, in numbers alone.
 *
 * Its own file because both sides need these and only one side is Node. The
 * browser's picker shares the server's limits so a photo the page accepts is
 * never one the endpoint then refuses — but `_photo.js` builds a Buffer at
 * module scope, and importing it for three constants put `Buffer.from` on the
 * first line the browser ran. The whole portal white-screened with
 * "Buffer is not defined".
 *
 * So: no imports, no Node, nothing but numbers. Anything that needs a Buffer
 * lives next door and never crosses.
 */

/** How many photographs one capture may carry. */
export const MAX_PHOTOS = 4;

/* The ceiling is not ours: a serverless request body is capped at about 4.5MB,
   and base64 sits in that body one character to the byte — so the budget is
   ~4.5 million characters for everything, JSON and all. Four million leaves
   room for the rest of the request and for being wrong about the exact limit.

   Base64 is four characters to every three bytes, so 2.6M characters is about
   a 1.9MB photograph — generous for one. A camera photo resized to 1600px is
   nearer 400KB, and four of those fit comfortably inside the total. */
export const MAX_ONE = 2_600_000;
export const MAX_ALL = 4_000_000;
