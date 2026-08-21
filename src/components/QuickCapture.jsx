import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GiQuillInk, GiCancel } from 'react-icons/gi';
import { useCapture } from '../contexts/CaptureContext';
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
    const inputRef = useRef(null);

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

    const send = async () => {
        if (!text.trim() || pending) return;
        const outcome = await submit(text);
        // Keep the text on failure so a bad connection does not eat the thought.
        if (outcome) setText('');
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
                className="quick-capture__bar"
                onSubmit={(e) => { e.preventDefault(); send(); }}
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
                    disabled={pending}
                />

                <kbd className="quick-capture__hint" aria-hidden="true">⌘K</kbd>

                <button
                    type="submit"
                    className="quick-capture__send"
                    disabled={!text.trim() || pending}
                >
                    {pending ? 'Filing…' : 'Add'}
                </button>
            </form>

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
