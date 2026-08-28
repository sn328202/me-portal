import React, { useState } from 'react';
import { settled, asDate } from '../utils/dateField';

/**
 * A date input that does not save what you are halfway through typing.
 *
 * A plain controlled `<input type="date">` writing through on change is a
 * data-loss bug wearing an ordinary shirt: typing 2026 into the year sends
 * 0002, then 0020, then 0202 on the way, and the value coming back replaces
 * what is being typed so the year can never be finished.
 *
 * So: the draft is local while she is in the field, the prop wins whenever
 * she is not, and a value only leaves here once it is a date a person would
 * type. A half-typed year that never settles is discarded on the way out
 * rather than saved — she meant to change the date and did not finish, and
 * the old date is a better answer than the year 202.
 */
const DateField = ({ value, onCommit, className = '', ...rest }) => {
    const incoming = asDate(value);
    const [draft, setDraft] = useState(incoming);
    const [seen, setSeen] = useState(incoming);
    const [editing, setEditing] = useState(false);

    // While she is typing, what she is typing wins. The rest of the time the
    // stored value does — so a date changed elsewhere still shows up here.
    // Adjusted during render rather than in an effect: an effect paints the
    // stale value first and then corrects it, which is a visible flicker on a
    // field she is looking straight at.
    if (incoming !== seen) {
        setSeen(incoming);
        if (!editing) setDraft(incoming);
    }

    const commit = (next) => {
        if (next !== incoming) onCommit(next);
    };

    return (
        <input
            {...rest}
            type="date"
            className={className}
            value={draft}
            onFocus={() => setEditing(true)}
            onChange={(e) => {
                const next = e.target.value;
                setDraft(next);
                // Saved the moment it is a real date, so tabbing away is not
                // required and picking from the calendar still saves at once.
                if (settled(next)) commit(next);
            }}
            onBlur={() => {
                setEditing(false);
                if (settled(draft)) commit(draft);
                // Left mid-year. Put the stored date back rather than keeping
                // a number on screen that was never saved.
                else setDraft(incoming);
            }}
        />
    );
};

export default DateField;
