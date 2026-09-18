/**
 * The arithmetic behind a cook plan.
 *
 * A plan is a list of steps, each one a number of minutes before the food is
 * served, turned into a time you can read on a clock and a date you can read
 * on a calendar. The model that writes the steps is asked only for the
 * number — "start this 14 hours before you serve" — because a model asked to
 * work out that 14 hours before Saturday 8pm is Friday at 6am will sometimes
 * say Saturday, and a soak that starts twelve hours late is a dinner that does
 * not happen.
 *
 * So the clock arithmetic lives here, pure and tested, and never touches a
 * Date: the serve time is a wall clock — "Saturday at 8" — and a wall clock
 * put through a Date comes back as whatever instant the machine thinks that
 * was, which is the same mistake the travel tables were rebuilt to stop
 * making. Integer maths on the date parts has no timezone to be wrong about.
 *
 * No Node in here: the browser imports this file to draw the plan it is given.
 */

/* ---------- civil dates, without a Date ---------------------------------- */

/* Days since 1970-01-01 for a civil date, and back again. Hinnant's algorithm:
   shift the year so March is the first month, and the leap day lands at the
   end of the cycle where it stops disturbing anything. */
const daysFromCivil = (y, m, d) => {
    const yy = y - (m <= 2 ? 1 : 0);
    const era = Math.floor(yy / 400);
    const yoe = yy - era * 400;
    const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
};

const civilFromDays = (z) => {
    const zz = z + 719468;
    const era = Math.floor(zz / 146097);
    const doe = zz - era * 146097;
    const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    const y = yoe + era * 400;
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    const mp = Math.floor((5 * doy + 2) / 153);
    const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    const m = mp + (mp < 10 ? 3 : -9);
    return { y: y + (m <= 2 ? 1 : 0), m, d };
};

const pad = (n) => String(n).padStart(2, '0');

/** "2026-09-26" to { y, m, d }, or null if that is not a date. */
export const readDate = (value) => {
    const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
    if (!hit) return null;
    const [, y, m, d] = hit.map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    // A date that does not survive the round trip never existed: 31 February
    // comes back as 3 March, and a plan hung off it would be a day out.
    const back = civilFromDays(daysFromCivil(y, m, d));
    if (back.y !== y || back.m !== m || back.d !== d) return null;
    return { y, m, d };
};

export const writeDate = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;

/** "20:00", "8:00 pm", "8pm" to minutes past midnight, or null. */
export const readClock = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    const hit = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(raw);
    if (!hit) return null;
    let h = Number(hit[1]);
    const m = Number(hit[2] || 0);
    const suffix = hit[3];
    if (m > 59) return null;
    if (suffix) {
        if (h < 1 || h > 12) return null;
        if (h === 12) h = 0;
        if (suffix === 'pm') h += 12;
    } else if (h > 23) return null;
    return h * 60 + m;
};

export const writeClock = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

/** The same minute said the way a kitchen says it: "6:00 am", "8:30 pm". */
export const clockLabel = (value) => {
    const mins = readClock(value);
    if (mins === null) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const suffix = h < 12 ? 'am' : 'pm';
    const twelve = h % 12 === 0 ? 12 : h % 12;
    return `${twelve}:${pad(m)} ${suffix}`;
};

/**
 * N minutes before a wall clock, as another wall clock.
 *
 * This is the whole reason the module exists: 14 hours before Saturday 8pm is
 * Friday at 6am, and nothing here needs to know what timezone she is in to
 * say so.
 */
export const minutesBefore = (date, time, mins) => {
    const day = readDate(date);
    const clock = readClock(time);
    if (!day || clock === null || !Number.isFinite(mins)) return null;

    const total = daysFromCivil(day.y, day.m, day.d) * 1440 + clock - Math.round(mins);
    const dayIndex = Math.floor(total / 1440);
    const within = total - dayIndex * 1440;   // floor division: never negative
    return { date: writeDate(civilFromDays(dayIndex)), time: writeClock(within) };
};

/**
 * The other direction: a wall clock, back to minutes before serving.
 *
 * What a step edited by hand needs — she moves "take the lamb out" to 6pm and
 * the plan has to know that is two hours before, so it still holds if dinner
 * moves.
 */
export const offsetFrom = ({ serve_date: serveDate, serve_time: serveTime } = {}, { date, time } = {}) => {
    const serveClock = readClock(serveTime);
    const atClock = readClock(time);
    const days = daysBetween(date, serveDate);
    if (serveClock === null || atClock === null || days === null) return null;
    return days * 1440 + serveClock - atClock;
};

/** Whole days between two dates, later minus earlier. */
export const daysBetween = (from, to) => {
    const a = readDate(from);
    const b = readDate(to);
    if (!a || !b) return null;
    return daysFromCivil(b.y, b.m, b.d) - daysFromCivil(a.y, a.m, a.d);
};

/* ---------- the plan ----------------------------------------------------- */

export const MAX_STEPS = 40;
const MAX_AHEAD = 7 * 24 * 60;    // a week before; anything older is a mistake
const MAX_LENGTH = 24 * 60;       // one step, at most a day of it

const text = (value, limit) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);

/**
 * Raw steps from the model, turned into a plan she can read.
 *
 * Sorted earliest first, because a plan is read top to bottom and the thing
 * that happens first is the thing that is easiest to miss. Anything without a
 * sentence in it is dropped: a step that does not say what to do is not a step.
 */
export const normaliseSteps = (raw, { serve_date: serveDate, serve_time: serveTime } = {}) => {
    if (!readDate(serveDate) || readClock(serveTime) === null) return [];

    const kept = [];
    for (const step of Array.isArray(raw) ? raw : []) {
        const what = text(step?.what, 300);
        if (!what) continue;

        const ahead = Math.min(Math.max(Math.round(Number(step?.starts_before_serve) || 0), 0), MAX_AHEAD);
        const at = minutesBefore(serveDate, serveTime, ahead);
        if (!at) continue;

        kept.push({
            what,
            dish: text(step?.dish, 120),
            recipe_id: typeof step?.recipe_id === 'string' ? step.recipe_id : null,
            // How long it takes, as distinct from how long before serving it
            // starts — "10 minutes of work that has to happen 14 hours ahead".
            minutes: Math.min(Math.max(Math.round(Number(step?.minutes) || 0), 0), MAX_LENGTH),
            // Waiting is not working. A plan that counts eight hours of soaking
            // as eight hours of cooking reads as an impossible day.
            waiting: !!step?.waiting,
            starts_before_serve: ahead,
            at_date: at.date,
            at_time: at.time,
            done: false,
        });
        if (kept.length >= MAX_STEPS) break;
    }

    return sortSteps(kept).map((step, i) => ({ id: `s${i + 1}`, ...step }));
};

/** Earliest first, and within a minute the longer job leads. */
export const sortSteps = (steps = []) => [...steps].sort((a, b) => (
    `${a.at_date}T${a.at_time}`.localeCompare(`${b.at_date}T${b.at_time}`)
    || (b.minutes || 0) - (a.minutes || 0)
    || String(a.what).localeCompare(String(b.what))
));

/** "The day before", and the rest of the calendar as a cook thinks of it. */
export const dayLabel = (date, serveDate) => {
    const away = daysBetween(date, serveDate);
    if (away === null) return '';
    if (away <= 0) return 'On the day';
    if (away === 1) return 'The day before';
    if (away === 2) return 'Two days before';
    if (away === 3) return 'Three days before';
    return `${away} days before`;
};

/** The plan as days, because that is how it gets done. */
export const groupByDay = (steps = [], serveDate) => {
    const days = [];
    for (const step of sortSteps(steps)) {
        const last = days[days.length - 1];
        if (last && last.date === step.at_date) last.steps.push(step);
        else days.push({ date: step.at_date, label: dayLabel(step.at_date, serveDate), steps: [step] });
    }
    return days;
};

/**
 * What the plan asks of her, in the two numbers that matter: when she has to
 * start, and how much of it is actually work.
 */
export const planLoad = (steps = []) => {
    const rows = sortSteps(steps);
    const hands = rows.filter((s) => !s.waiting).reduce((sum, s) => sum + (s.minutes || 0), 0);
    return {
        steps: rows.length,
        starts: rows[0] ? { date: rows[0].at_date, time: rows[0].at_time } : null,
        handsOn: hands,
        done: rows.filter((s) => s.done).length,
    };
};

/** "1 hr 20 min", the way the rest of the app says a length of time. */
export const lengthLabel = (mins) => {
    const total = Math.max(Math.round(Number(mins) || 0), 0);
    if (!total) return '';
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (!h) return `${m} min`;
    return m ? `${h} hr ${m} min` : `${h} hr`;
};

/** A plan, stamped with what it was built from. */
export const stampPlan = ({ serve_date: serveDate, serve_time: serveTime, steps = [], note = '' } = {}) => ({
    serve_date: serveDate,
    serve_time: serveTime,
    note: text(note, 400),
    built_at: new Date().toISOString(),
    steps,
});

/**
 * A plan built for one serve time, moved to another.
 *
 * She sets Saturday 8pm, builds the plan, then the dinner moves to 7. Every
 * step keeps its distance from the food going out and the clocks are worked
 * out again — which is cheaper than asking the model a second time and, more
 * to the point, does not quietly rewrite the plan she has already read.
 */
export const replanFor = (plan, { serve_date: serveDate, serve_time: serveTime } = {}) => {
    if (!plan) return null;
    if (!readDate(serveDate) || readClock(serveTime) === null) return plan;

    const steps = (plan.steps || []).map((step) => {
        const at = minutesBefore(serveDate, serveTime, step.starts_before_serve || 0);
        return at ? { ...step, at_date: at.date, at_time: at.time } : step;
    });

    return { ...plan, serve_date: serveDate, serve_time: serveTime, steps: sortSteps(steps) };
};
