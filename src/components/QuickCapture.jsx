import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GiQuillInk, GiCancel, GiPhotoCamera } from 'react-icons/gi';
import { useCapture } from '../contexts/CaptureContext';
import { pickPhotos, shrinkAll, base64Length, ACCEPT, MAX_PHOTOS } from '../utils/photoPick';
import '../styles/QuickCapture.css';

/**
 * The typed half of the dictation feature: one box, present on every page,
 * that takes an unstructured thought and files it.
 *
 * Same endpoint as the phone Shortcut, so anything the voice capture can route
 * — groceries, tasks, spots, recipes, Treasury items, trips — works here with
 * no extra wiring.
 *
 * A textarea rather than an input because thoughts arrive in more than one
 * clause. Enter sends, Shift+Enter starts a line, and it grows to fit rather
 * than scrolling a two-line box.
 */

/* Short on purpose. A longer example placeholder taught the useful thing —
   that two unrelated thoughts in one sentence both get filed — exactly once,
   then wrapped to two lines on a phone and made an empty box 90px tall
   forever after. */
const PLACEHOLDER = 'Add anything…';

const MAX_ROWS_PX = 180;

const QuickCapture = () => {
    const { submit, undo, dismiss, pending, result } = useCapture();
    const [text, setText] = useState('');
    /* Pictures waiting to go with the words. Held here rather than sent on
       sight so she can add a caption, or a second page, before it files —
       and so a cookbook spread arrives as one recipe rather than two. */
    const [photos, setPhotos] = useState([]);
    const [photoNote, setPhotoNote] = useState(null);
    const [over, setOver] = useState(false);
    // Reading and re-encoding a few megapixels takes a visible moment.
    const [shrinking, setShrinking] = useState(false);
    const inputRef = useRef(null);
    const fileRef = useRef(null);

    const grow = useCallback((value) => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        // Empty falls back to the CSS floor, so the resting state is one row
        // whatever the placeholder happens to say.
        el.style.height = value ? `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px` : '';
    }, []);

    useEffect(() => { grow(text); }, [text, grow]);

    // ⌘K / Ctrl+K from anywhere. Deliberately not a bare "/" — that would
    // hijack the key inside every other field in the app.
    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    /* Paste, drop or the camera button, all landing in one place.
     *
       Shrinking happens here, not on the server: a photograph off a phone is
       three to five megabytes and the request body stops at about four and a
       half. The first real photograph anybody took came back "too big", which
       is a limit reported rather than a problem solved. */
    const take = useCallback(async (files) => {
        const { files: wanted, problems } = pickPhotos(files, photos.length);
        if (!wanted.length) {
            setPhotoNote(problems.length ? problems.join(' · ') : null);
            return;
        }

        setShrinking(true);
        try {
            const already = photos.reduce((n, p) => n + base64Length(p.data), 0);
            const { photos: done, problems: bad } = await shrinkAll(wanted, already);
            setPhotoNote([...problems, ...bad].join(' · ') || null);
            setPhotos((prev) => [...prev, ...done.map(({ file, data }) => ({
                data, name: file.name, url: URL.createObjectURL(file),
            }))]);
        } finally {
            setShrinking(false);
        }
    }, [photos]);

    const drop = (e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer?.files?.length) take(e.dataTransfer.files);
    };

    const paste = (e) => {
        const files = Array.from(e.clipboardData?.files || []);
        if (files.length) { e.preventDefault(); take(files); }
    };

    const drop1 = (i) => setPhotos((prev) => {
        URL.revokeObjectURL(prev[i]?.url);
        return prev.filter((_, n) => n !== i);
    });

    const send = async () => {
        if ((!text.trim() && !photos.length) || pending) return;
        const outcome = await submit(text, photos.map((p) => p.data));
        // Keep the text on failure so a bad connection does not eat the thought.
        if (outcome) {
            setText('');
            photos.forEach((p) => URL.revokeObjectURL(p.url));
            setPhotos([]);
            setPhotoNote(null);
        }
    };

    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
        if (e.key === 'Escape') inputRef.current?.blur();
    };

    const rooms = [...new Set((result?.actions || []).map((a) => a.table))];

    return (
        <div className="quick-capture">
            <form
                className={`quick-capture__bar${over ? ' is-over' : ''}`}
                onSubmit={(e) => { e.preventDefault(); send(); }}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={drop}
            >
                <span className="quick-capture__glyph" aria-hidden="true"><GiQuillInk /></span>

                <textarea
                    ref={inputRef}
                    className="quick-capture__input"
                    rows={1}
                    value={text}
                    placeholder={PLACEHOLDER}
                    aria-label="Add anything — it will be filed where it belongs"
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={onKeyDown}
                    onPaste={paste}
                    disabled={pending}
                />

                <kbd className="quick-capture__hint" aria-hidden="true">⌘K</kbd>

                {/* A cookbook page is the point of this. Drag one in, paste a
                    screenshot, or pick one — all the same road. */}
                <input
                    ref={fileRef}
                    type="file"
                    className="quick-capture__file"
                    accept={ACCEPT}
                    multiple
                    onChange={(e) => { take(e.target.files); e.target.value = ''; }}
                />
                <button
                    type="button"
                    className="quick-capture__camera"
                    title={`Add a photo — a recipe page, a label (up to ${MAX_PHOTOS})`}
                    aria-label="Add a photo"
                    onClick={() => fileRef.current?.click()}
                    disabled={pending || shrinking || photos.length >= MAX_PHOTOS}
                >
                    <GiPhotoCamera />
                </button>

                <button
                    type="submit"
                    className="quick-capture__send"
                    disabled={(!text.trim() && !photos.length) || pending || shrinking}
                >
                    {pending ? 'Filing…' : shrinking ? 'Reading…' : 'Add'}
                </button>
            </form>

            {(photos.length > 0 || photoNote || shrinking) && (
                <div className="quick-capture__photos">
                    {photos.map((p, i) => (
                        <span className="quick-capture__photo" key={p.url}>
                            <img src={p.url} alt={p.name} />
                            {/* Numbered, because order is what makes two pages
                                one recipe rather than two. */}
                            {photos.length > 1 && <em>{i + 1}</em>}
                            <button
                                type="button"
                                aria-label={`Remove ${p.name}`}
                                onClick={() => drop1(i)}
                            >
                                <GiCancel />
                            </button>
                        </span>
                    ))}
                    {photos.length > 1 && (
                        <span className="quick-capture__photo-note">
                            Read together, in this order, as one thing.
                        </span>
                    )}
                    {shrinking && <span className="quick-capture__photo-note">Resizing…</span>}
                    {photoNote && <span className="quick-capture__photo-bad">{photoNote}</span>}
                </div>
            )}

            {result && (
                <div
                    className={`quick-capture__result${result.error && !result.actions?.length ? ' quick-capture__result--bad' : ''}`}
                    role="status"
                    aria-live="polite"
                >
                    <p className="quick-capture__summary">
                        {result.error && !result.actions?.length
                            ? result.error
                            : result.summary}
                    </p>

                    <div className="quick-capture__result-actions">
                        {rooms.length > 0 && !result.undone && (
                            <span className="quick-capture__rooms">{rooms.length} row{rooms.length > 1 ? 's' : ''}</span>
                        )}
                        {result.actions?.length > 0 && !result.undone && (
                            <button type="button" className="quick-capture__undo" onClick={undo}>
                                Undo
                            </button>
                        )}
                        <button
                            type="button"
                            className="quick-capture__dismiss"
                            aria-label="Dismiss"
                            onClick={dismiss}
                        >
                            <GiCancel />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuickCapture;
