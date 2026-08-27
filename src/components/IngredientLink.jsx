import React, { useState, useMemo, useRef, useEffect } from 'react';
import { GiLinkedRings } from 'react-icons/gi';

/**
 * Point a recipe's wording at a pantry ingredient, by hand.
 *
 * The matcher's synonym table can only ever be a guess at one person's
 * vocabulary — it knows `deggi mirch` because this pantry is Indian, and it
 * will never know the next thing she buys. This is the correction: when a line
 * finds nothing, or finds the wrong thing, she picks the right ingredient and
 * the wording is written into that ingredient's aliases. Every recipe after
 * this one matches it without being asked.
 *
 * The list is ranked by the same scoring that failed to reach a conclusion on
 * its own, so the plausible candidates are already at the top. 176 rows is far
 * too many to scroll, and the thing she wants is almost always in the first
 * three.
 */
/** Roughly what the popover needs; only used to decide which way it opens. */
const POPOVER_HEIGHT = 320;

const IngredientLink = ({ line, matcher, ingredients, onLink, onCreate }) => {
    const [open, setOpen] = useState(false);
    const [above, setAbove] = useState(false);
    const [query, setQuery] = useState('');
    const boxRef = useRef(null);
    const inputRef = useRef(null);

    // Close on an outside click or Escape, the way a popover is expected to.
    useEffect(() => {
        if (!open) return undefined;

        // Ingredient lists are long and this control sits on every row, so the
        // popover is usually opened near the bottom of the screen - where a
        // list that only ever drops downwards is cut off by the viewport and
        // the options cannot be reached at all. Flip it when there is no room.
        const rect = boxRef.current?.getBoundingClientRect();
        if (rect) {
            const below = window.innerHeight - rect.bottom;
            setAbove(below < POPOVER_HEIGHT && rect.top > below);
        }

        const onDown = (e) => {
            if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        inputRef.current?.focus();
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const options = useMemo(() => {
        if (!open) return [];
        const typed = query.trim().toLowerCase();

        // Typing searches the whole pantry; not typing shows the shortlist.
        if (typed) {
            return (ingredients || [])
                .filter((i) => `${i.label || ''} ${i.name || ''}`.toLowerCase().includes(typed))
                .slice(0, 8);
        }

        return matcher.suggest(line.raw, 6)
            .map((s) => s.item)
            // Offering the thing it already picked as a correction for itself
            // is just noise.
            .filter((i) => i.id !== line.match?.id);
    }, [open, query, ingredients, matcher, line]);

    const choose = (item) => {
        onLink(item.id, line.normalised);
        setOpen(false);
        setQuery('');
    };

    return (
        <span className="ing-link" ref={boxRef}>
            <button
                type="button"
                className="ing-link__trigger"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
            >
                <GiLinkedRings /> {line.match ? 'not this?' : 'link'}
            </button>

            {open && (
                <div className={`ing-link__pop${above ? ' ing-link__pop--above' : ''}`}>
                    <p className="ing-link__intro">
                        Treat <strong>{line.normalised}</strong> as:
                    </p>
                    <input
                        ref={inputRef}
                        type="search"
                        className="ing-link__search"
                        placeholder="Search your pantry…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <ul className="ing-link__options">
                        {options.map((item) => (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    className="ing-link__option"
                                    onClick={() => choose(item)}
                                >
                                    <span aria-hidden="true">{item.icon}</span>
                                    <span className="ing-link__option-name">
                                        {item.label || item.name}
                                    </span>
                                    {!item.in_stock && <span className="ing-link__out">out</span>}
                                </button>
                            </li>
                        ))}
                        {options.length === 0 && (
                            <li className="ing-link__empty">Nothing matching.</li>
                        )}
                    </ul>

                    {/* The honest third option: sometimes the pantry really has
                        never held this, and the answer is a new row, not a link. */}
                    {!line.match && onCreate && (
                        <button
                            type="button"
                            className="ing-link__create"
                            onClick={() => { onCreate(line.raw); setOpen(false); }}
                        >
                            + Add “{line.normalised}” as a new ingredient
                        </button>
                    )}
                </div>
            )}
        </span>
    );
};

export default IngredientLink;
