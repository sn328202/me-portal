/**
 * iCalendar parsing, server-side.
 *
 * The client already had a parser (src/utils/icsParser.js) but it reads only
 * DTSTART and SUMMARY off raw lines. Three things that breaks on a real
 * calendar:
 *
 *   - **Folded lines.** RFC 5545 wraps anything over 75 octets onto a
 *     continuation line beginning with a space. Unfolded naively, a long title
 *     is truncated and its remainder is parsed as a bogus property.
 *   - **Recurrence.** A weekly standup is one VEVENT with an RRULE. Without
 *     expansion it appears once and the calendar looks empty.
 *   - **All-day vs timed.** DTSTART;VALUE=DATE has no time and must not be
 *     shifted by a timezone, or every all-day event lands on the wrong day.
 *
 * Doing this on the server means the browser receives plain JSON and none of
 * this ships in the bundle.
 */

/* ---------- unfolding and property parsing ----------------------------- */

/** RFC 5545 §3.1: a line beginning with a space or tab continues the previous one. */
export const unfold = (text) =>
    String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n[ \t]/g, '');

/** TEXT values escape commas, semicolons and newlines. */
const unescapeText = (v) =>
    String(v || '')
        .replace(/\\n/gi, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');

/**
 * "DTSTART;TZID=America/Los_Angeles:20260821T090000"
 *   -> { name: 'DTSTART', params: { TZID: '...' }, value: '20260821T090000' }
 */
export const parseLine = (line) => {
    const colon = line.indexOf(':');
    if (colon === -1) return null;

    const head = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const [name, ...paramParts] = head.split(';');

    const params = {};
    for (const part of paramParts) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, '');
    }

    return { name: name.toUpperCase(), params, value };
};

/* ---------- dates ------------------------------------------------------- */

/**
 * ICS gives three shapes: 20260821 (all-day), 20260821T090000Z (UTC), and
 * 20260821T090000 with a TZID.
 *
 * Floating and TZID times are treated as UTC here. Doing it properly needs the
 * full IANA rule set; the visible cost is an event drawn at the wrong hour for
 * a calendar published in another zone, which is a much smaller error than the
 * event not appearing at all.
 */
export const parseDate = (value, params = {}) => {
    const raw = String(value || '').trim();
    const allDay = params.VALUE === 'DATE' || /^\d{8}$/.test(raw);

    const y = Number(raw.slice(0, 4));
    const m = Number(raw.slice(4, 6));
    const d = Number(raw.slice(6, 8));
    if (!y || !m || !d) return null;

    if (allDay) {
        return { date: Date.UTC(y, m - 1, d), allDay: true };
    }

    const hh = Number(raw.slice(9, 11)) || 0;
    const mm = Number(raw.slice(11, 13)) || 0;
    const ss = Number(raw.slice(13, 15)) || 0;
    return { date: Date.UTC(y, m - 1, d, hh, mm, ss), allDay: false };
};

const DAY = 86400000;
const WEEKDAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/** "FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261231T000000Z" -> object */
const parseRule = (value) => {
    const rule = {};
    for (const part of String(value || '').split(';')) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        rule[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
    }
    return rule;
};

/**
 * Expand a recurring event into concrete start times inside [from, to].
 *
 * Covers DAILY / WEEKLY / MONTHLY / YEARLY with INTERVAL, COUNT, UNTIL and
 * BYDAY — which is everything a person's calendar actually contains. Anything
 * more exotic falls back to the single original occurrence rather than
 * guessing.
 */
export const expandRecurrence = (start, ruleValue, from, to, exdates = []) => {
    const rule = parseRule(ruleValue);
    const freq = (rule.FREQ || '').toUpperCase();
    if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return [start];

    const interval = Math.max(1, Number(rule.INTERVAL) || 1);
    const count = rule.COUNT ? Number(rule.COUNT) : null;
    const until = rule.UNTIL ? parseDate(rule.UNTIL)?.date ?? null : null;
    const byDay = rule.BYDAY
        ? rule.BYDAY.split(',').map((d) => WEEKDAYS[d.trim().slice(-2).toUpperCase()]).filter((n) => n !== undefined)
        : null;

    const skip = new Set(exdates);
    const out = [];
    // A hard ceiling so a malformed rule cannot spin forever. Two years of
    // daily events is far more than any window asks for.
    const MAX = 1000;

    const d = new Date(start);
    let emitted = 0;

    for (let i = 0; i < MAX; i += 1) {
        const t = d.getTime();
        if (until !== null && t > until) break;
        if (count !== null && emitted >= count) break;
        if (t > to) break;

        // BYDAY on a weekly rule means several days per interval week.
        if (freq === 'WEEKLY' && byDay && byDay.length) {
            const weekStart = t - (d.getUTCDay() * DAY);
            for (const wd of byDay) {
                const occurrence = weekStart + wd * DAY;
                if (occurrence < start) continue;
                if (until !== null && occurrence > until) continue;
                if (occurrence >= from && occurrence <= to && !skip.has(occurrence)) out.push(occurrence);
            }
            emitted += byDay.length;
            d.setUTCDate(d.getUTCDate() + 7 * interval);
            continue;
        }

        if (t >= from && !skip.has(t)) out.push(t);
        emitted += 1;

        if (freq === 'DAILY') d.setUTCDate(d.getUTCDate() + interval);
        else if (freq === 'WEEKLY') d.setUTCDate(d.getUTCDate() + 7 * interval);
        else if (freq === 'MONTHLY') d.setUTCMonth(d.getUTCMonth() + interval);
        else d.setUTCFullYear(d.getUTCFullYear() + interval);
    }

    return [...new Set(out)].sort((a, b) => a - b);
};

/* ---------- the parser -------------------------------------------------- */

/**
 * Parse an ICS document into events between `from` and `to` (epoch ms).
 * `source` labels which calendar each event came from, so a merged agenda can
 * still tell work from personal.
 */
export function parseCalendar(text, { from, to, source = null, color = null } = {}) {
    const lines = unfold(text).split('\n');
    const events = [];

    let current = null;
    let calendarName = null;

    for (const line of lines) {
        if (line.startsWith('BEGIN:VEVENT')) {
            current = { exdates: [] };
            continue;
        }

        if (line.startsWith('END:VEVENT')) {
            if (current && current.start) {
                const duration = current.end ? Math.max(0, current.end.date - current.start.date) : 0;
                const starts = current.rrule
                    ? expandRecurrence(current.start.date, current.rrule, from, to, current.exdates)
                    : (current.start.date >= from && current.start.date <= to ? [current.start.date] : []);

                for (const startMs of starts) {
                    events.push({
                        // Stable across refetches: same event, same occurrence,
                        // same id, so React keys do not churn.
                        id: `${current.uid || 'ics'}-${startMs}`,
                        title: current.summary || '(untitled)',
                        start: new Date(startMs).toISOString(),
                        end: new Date(startMs + duration).toISOString(),
                        allDay: current.start.allDay,
                        location: current.location || null,
                        status: current.status || null,
                        source,
                        color,
                    });
                }
            }
            current = null;
            continue;
        }

        const parsed = parseLine(line);
        if (!parsed) continue;

        if (!current) {
            if (parsed.name === 'X-WR-CALNAME') calendarName = unescapeText(parsed.value);
            continue;
        }

        switch (parsed.name) {
            case 'UID': current.uid = parsed.value; break;
            case 'SUMMARY': current.summary = unescapeText(parsed.value); break;
            case 'LOCATION': current.location = unescapeText(parsed.value); break;
            case 'STATUS': current.status = parsed.value; break;
            case 'RRULE': current.rrule = parsed.value; break;
            case 'DTSTART': current.start = parseDate(parsed.value, parsed.params); break;
            case 'DTEND': current.end = parseDate(parsed.value, parsed.params); break;
            case 'EXDATE': {
                for (const one of parsed.value.split(',')) {
                    const ex = parseDate(one, parsed.params);
                    if (ex) current.exdates.push(ex.date);
                }
                break;
            }
            default: break;
        }
    }

    // Cancelled events remain in the feed as tombstones; showing them as
    // ordinary entries is worse than not showing them.
    const live = events.filter((e) => e.status !== 'CANCELLED');
    live.sort((a, b) => new Date(a.start) - new Date(b.start));

    return { calendarName, events: live };
}

/**
 * Every event titled exactly "Busy" is the signature of a calendar shared as
 * "See only free/busy". Worth detecting so the UI can say so instead of
 * letting her wonder where her event titles went.
 */
export const isFreeBusyOnly = (events) =>
    events.length > 0 && events.every((e) => /^(busy|free)$/i.test(e.title.trim()));
