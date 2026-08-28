import React, { useEffect, useRef, useState } from 'react';
import { mentionAt, replaceMention, placeSubtitle } from '../utils/mention';
import { usePlaceSearch } from '../hooks/usePlaceSearch';

/**
 * A text field where "@masque" looks the place up and brings its link with it.
 *
 * The interaction is the one Google Docs has, deliberately: @ opens a menu,
 * the arrow keys move through it, Enter takes the highlighted one, Escape
 * closes it and leaves the text alone. Anything else and it is a new thing to
 * learn rather than a thing you already know.
 *
 * What it does *not* do is force a choice. The menu is a suggestion; carry on
 * typing and the "@masque" stays as typed, which matters because half of what
 * goes in these boxes is not a place at all.
 */

const MentionInput = ({
    value = '',
    onChange,
    onPick,
    city = null,
    inputRef,
    onKeyDown,
    className = '',
    ...rest
}) => {
    const own = useRef(null);
    const field = inputRef || own;

    /* The mention under the caret, or null. Held rather than derived because
       Escape has to be able to dismiss the menu without changing the text. */
    const [token, setToken] = useState(null);
    const [highlight, setHighlight] = useState(0);
    /* Where the caret should go after a pick. A ref rather than state: the
       DOM has to be told once, after React has written the new value, and
       storing it as state would mean a render whose only job is to clear it. */
    const pendingCaret = useRef(null);

    const { results, busy } = usePlaceSearch(token?.query, city);
    const open = Boolean(token) && (results.length > 0 || busy);
    /* The list can come back shorter than the last one, so the highlight is
       clamped where it is used rather than trusted where it is stored. */
    const at = results.length ? Math.min(highlight, results.length - 1) : 0;

    useEffect(() => {
        if (pendingCaret.current === null || !field.current) return;
        const at = pendingCaret.current;
        pendingCaret.current = null;
        field.current.setSelectionRange(at, at);
    }, [value, field]);

    const look = (el) => {
        const next = mentionAt(el.value, el.selectionStart);
        setToken(next);
        // A different query is a different list, so the highlight goes back to
        // the top. Done here rather than in an effect: it is a consequence of
        // the keystroke, not of the render.
        if ((next?.query ?? null) !== (token?.query ?? null)) setHighlight(0);
    };

    const choose = (place) => {
        const { text, caret: next } = replaceMention(value, token, place.name);
        setToken(null);
        onChange?.(text);
        onPick?.(place, text);
        pendingCaret.current = next;
        field.current?.focus();
    };

    const keys = (e) => {
        if (open) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlight((i) => (i + 1) % Math.max(1, results.length));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlight((i) => (i - 1 + results.length) % Math.max(1, results.length));
                return;
            }
            if ((e.key === 'Enter' || e.key === 'Tab') && results[at]) {
                e.preventDefault();
                // Stop the surrounding form from submitting the half-typed
                // "@masq" as if it were the whole plan.
                e.stopPropagation();
                choose(results[at]);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setToken(null);
                return;
            }
        }
        onKeyDown?.(e);
    };

    return (
        <span className={`mention${open ? ' is-open' : ''}`}>
            <input
                {...rest}
                ref={field}
                type="text"
                className={className}
                value={value}
                autoComplete="off"
                onChange={(e) => { onChange?.(e.target.value); look(e.target); }}
                onKeyUp={(e) => look(e.target)}
                onClick={(e) => look(e.target)}
                onKeyDown={keys}
                /* A click on the menu blurs the field first, so the close is
                   delayed long enough for the click to land. */
                onBlur={() => setTimeout(() => setToken(null), 150)}
            />

            {open && (
                <ul className="mention__menu" role="listbox">
                    {results.map((place, i) => (
                        <li key={place.place_id || `${place.name}-${i}`}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={i === at}
                                className={`mention__hit${i === at ? ' is-on' : ''}`}
                                onMouseEnter={() => setHighlight(i)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => choose(place)}
                            >
                                <strong>{place.name}</strong>
                                <span>{placeSubtitle(place)}</span>
                                {place.rating != null && <em>{place.rating.toFixed(1)}</em>}
                            </button>
                        </li>
                    ))}
                    {busy && !results.length && (
                        <li className="mention__waiting">Looking…</li>
                    )}
                </ul>
            )}
        </span>
    );
};

export default MentionInput;
