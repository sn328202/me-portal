import React, { useRef, useState } from 'react';
import DateField from './DateField';
import { rangeLabel } from '../utils/dateRange';

/**
 * Two dates, as a phrase you can click.
 *
 * A pair of native date inputs is enormous — between them they were taking a
 * third of the width of every row in the card — and what they were spending
 * it on was slashes. Almost all of the time the dates are set and being read,
 * not changed, so almost all of the time they can be four words.
 *
 * It opens on a click and closes when focus leaves it, which is the same
 * gesture as clicking into a field and clicking away from it — no Done button
 * to find, and no way to get stuck in the open state.
 */
const DateRange = ({
    from, to, onFrom, onTo,
    fromLabel = 'Start', toLabel = 'End',
    empty = 'Add dates',
    min, max,
}) => {
    const [open, setOpen] = useState(false);
    const box = useRef(null);

    if (!open) {
        const said = rangeLabel(from, to);
        return (
            <button
                type="button"
                className={`daterange__said${said ? '' : ' daterange__said--empty'}`}
                onClick={() => setOpen(true)}
                aria-label={said ? `Change the dates, currently ${said}` : empty}
            >
                {said || empty}
            </button>
        );
    }

    return (
        <span
            className="daterange"
            ref={box}
            /* Closes when focus leaves the pair entirely, so tabbing from the
               first date to the second does not shut it. */
            onBlur={(e) => {
                if (!box.current?.contains(e.relatedTarget)) setOpen(false);
            }}
        >
            <DateField
                value={from}
                aria-label={fromLabel}
                className="daterange__field"
                autoFocus
                min={min}
                max={max}
                onCommit={(v) => onFrom(v || null)}
            />
            <span className="daterange__dash">–</span>
            <DateField
                value={to}
                aria-label={toLabel}
                className="daterange__field"
                min={from || min}
                max={max}
                onCommit={(v) => onTo(v || null)}
            />
        </span>
    );
};

export default DateRange;
