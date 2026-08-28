import React, { useState, useEffect, useRef } from 'react';
import { GiClockwork } from 'react-icons/gi';
import Button from './ui/Button';

/**
 * A time, typed however she types times.
 *
 * "3pm", "15:00", "1530", "9" — all of them mean something, and all of them
 * mean it here. The list is a fallback rather than the way in.
 *
 * It did not stick, and there were two reasons.
 *
 * The input had no `onBlur`. What she typed lived in local state and was only
 * ever committed by a document-wide mousedown listener, so tabbing out of the
 * field, clicking browser chrome, or anything else that moved focus without a
 * mousedown inside the page left the typed time in a variable and then
 * overwrote it from the prop. Typed, gone.
 *
 * And that mousedown listener committed on *mousedown*, before the click it
 * belonged to. Committing a time re-sorts the day, so the card moved out from
 * under the thing she was about to click — the click landed somewhere else,
 * and it read as the time not taking.
 *
 * So: blur commits, mousedown only closes the list, and the list keeps focus
 * in the field so choosing from it is one event rather than two.
 */
const SmartTimeInput = ({ value, onChange, onBlur, label = 'Start time' }) => {
    const held = value || '';
    const [draft, setDraft] = useState(held);
    const [seen, setSeen] = useState(held);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const box = useRef(null);

    // The stored value wins whenever she is not typing into it — so a time
    // changed by dragging the card shows up here — and never while she is.
    // Adjusted during render rather than in an effect, which would paint the
    // old time first and then correct it.
    if (held !== seen) {
        setSeen(held);
        if (!editing) setDraft(held);
    }

    // Only closes the list. Committing is blur's job, and doing it here as
    // well committed a time before the click that caused it.
    useEffect(() => {
        if (!open) return undefined;
        const away = (e) => {
            if (box.current && !box.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', away);
        return () => document.removeEventListener('mousedown', away);
    }, [open]);

    /** "3pm", "1530", "9", "15:00" — all of them. Null for anything else. */
    const parseTime = (input) => {
        const text = String(input ?? '').toLowerCase().replace(/\s/g, '');
        if (!text) return null;

        let hours;
        let minutes;

        const withPeriod = /^(\d{1,2}):?(\d{2})?(am|pm)$/.exec(text);
        const plain = /^(\d{1,2}):?(\d{2})?$/.exec(text);

        if (withPeriod) {
            hours = Number(withPeriod[1]);
            minutes = withPeriod[2] ? Number(withPeriod[2]) : 0;
            if (withPeriod[3] === 'pm' && hours < 12) hours += 12;
            if (withPeriod[3] === 'am' && hours === 12) hours = 0;
        } else if (plain) {
            hours = Number(plain[1]);
            minutes = plain[2] ? Number(plain[2]) : 0;
        } else {
            return null;
        }

        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    /** What she typed, settled and sent on — once. */
    const commit = () => {
        setEditing(false);

        // Cleared on purpose. Distinct from unreadable, and worth honouring.
        if (draft.trim() === '') {
            setDraft('');
            if (value) onChange(null);
            onBlur?.();
            return;
        }

        const parsed = parseTime(draft);
        if (parsed) {
            setDraft(parsed);
            if (parsed !== value) onChange(parsed);
        } else {
            // Unreadable. The stored time is a better answer than half of one.
            setDraft(value || '');
        }
        onBlur?.();
    };

    const pick = (time) => {
        setEditing(false);
        setDraft(time);
        setOpen(false);
        if (time !== value) onChange(time);
    };

    const options = [];
    for (let h = 0; h < 24; h += 1) {
        for (let m = 0; m < 60; m += 15) {
            options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
    }

    return (
        <div ref={box} className="time-input">
            <div className="time-input__control">
                <input
                    type="text"
                    className="time-input__field"
                    aria-label={label}
                    value={draft}
                    placeholder="--:--"
                    onFocus={() => { setEditing(true); setOpen(true); }}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { setOpen(false); e.target.blur(); }
                        if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); setOpen(false); }
                        if (e.key === 'ArrowDown') setOpen(true);
                    }}
                />
                <Button
                    icon
                    size="sm"
                    label={open ? 'Hide time options' : 'Show time options'}
                    aria-expanded={open}
                    onClick={() => setOpen((o) => !o)}
                >
                    <GiClockwork />
                </Button>
            </div>

            {open && (
                <ul className="time-input__list">
                    {options.map((time) => (
                        <li key={time}>
                            <button
                                type="button"
                                className={`time-input__option${time === value ? ' is-current' : ''}`}
                                /* Keeps focus in the field, so choosing from
                                   the list does not fire blur first and
                                   commit a half-typed time on the way. */
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => pick(time)}
                            >
                                {time}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SmartTimeInput;
