import React from 'react';
import { GiHourglass } from 'react-icons/gi';
import { splitDuration, joinDuration, HOUR_STEPS, MINUTE_STEPS } from '../utils/duration';

/**
 * How long a stop takes: hours and minutes, picked.
 *
 * This was a text box, and a text box invites "a couple of hours", which
 * cannot be added to a start time. Worse, it invites "2", which the day's
 * arithmetic read as two hours and the person who typed it meant as two
 * hours — but "20" meant twenty minutes and was read as twenty hours. Every
 * one of those guesses was made silently and then used to decide whether she
 * was going to be late.
 *
 * Two dropdowns cannot be ambiguous. What is already stored is read with the
 * old parser and shown as its best reading, so nothing has to be retyped.
 */
const DurationPicker = ({ value, onChange, label }) => {
    const { hours, minutes } = splitDuration(value);

    // A minutes value from the old free-text field may not be one of the
    // steps ("38 min" happens). Show it rather than silently rounding her
    // number to something she did not say.
    const steps = MINUTE_STEPS.includes(minutes)
        ? MINUTE_STEPS
        : [...MINUTE_STEPS, minutes].sort((a, b) => a - b);

    const set = (h, m) => onChange(joinDuration(h, m));

    return (
        <span className="dur">
            <GiHourglass aria-hidden="true" />
            <select
                className="dur__field"
                aria-label={`Hours ${label ? `for ${label}` : ''}`.trim()}
                value={hours}
                onChange={(e) => set(Number(e.target.value), minutes)}
            >
                {HOUR_STEPS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
            <span className="dur__unit">hr</span>
            <select
                className="dur__field"
                aria-label={`Minutes ${label ? `for ${label}` : ''}`.trim()}
                value={minutes}
                onChange={(e) => set(hours, Number(e.target.value))}
            >
                {steps.map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
            </select>
            <span className="dur__unit">min</span>
        </span>
    );
};

export default DurationPicker;
