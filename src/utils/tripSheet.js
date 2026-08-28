/**
 * The trip, shaped like her spreadsheet.
 *
 * The template is not decoration. It is the layout she has actually planned
 * every trip in: a column per day, an hour per row from 6am to midnight, City
 * and Lodging as merged bands across however many days they cover, three side
 * columns for loose ideas, and five cost lines footing to a running per-person
 * total. Anything that claims to export "to a Google Sheet" and produces a flat
 * list of rows has not exported her itinerary — it has exported a database.
 *
 * So this builds the grid, in JavaScript, where it can be tested. The Apps
 * Script on the other end is deliberately stupid: it receives rows, merges and
 * widths, and writes them. Layout decisions that live in a script pasted into
 * script.google.com are layout decisions nobody can test or change safely.
 */

import { cityLabelOn } from './tripLegs.js';
import { nightsOf } from './tripCosts.js';

/* 6am to midnight, as the sheet has it. 12am is the end of the day, not the
   start of it, which is why the range runs to 24 rather than wrapping. */
const HOURS = Array.from({ length: 19 }, (_, i) => i + 6);

export const hourLabel = (hour) => {
    const h = hour % 24;
    const suffix = h < 12 ? 'AM' : 'PM';
    const twelve = h % 12 === 0 ? 12 : h % 12;
    return `${twelve}:00 ${suffix}`;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "Wed Dec 23" — built from the calendar fields, never from toISOString().
 *
 * A date-only string parsed as UTC and printed in a timezone behind it comes
 * out a day early, which on a trip export means every single column is wrong
 * and looks plausible.
 */
export const dayLabel = (date) => {
    const d = new Date(`${String(date).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return String(date || '');
    return `${WEEKDAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

const hourOf = (time) => {
    if (!time) return null;
    const h = Number(String(time).slice(0, 2));
    return Number.isFinite(h) ? h : null;
};

const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Contiguous runs of the same value, as column spans.
 *
 * This is what the merged City row was doing by hand: five columns of Goa is
 * one cell saying Goa, not five cells each saying Goa. A run only extends
 * while the label is unchanged *and* non-empty — merging a stretch of blanks
 * would silently swallow the days you have not decided yet, which are exactly
 * the ones you want to see as gaps.
 */
export const runsOf = (labels = []) => {
    const runs = [];
    let current = null;
    labels.forEach((label, i) => {
        const value = label == null ? '' : String(label);
        if (current && current.label === value && value !== '') {
            current.span += 1;
            return;
        }
        current = { label: value, start: i, span: 1 };
        runs.push(current);
    });
    return runs;
};

/** A row of empty strings, so every row in a tab is the same width. */
const blankRow = (width) => Array.from({ length: width }, () => '');

const COST_ROWS = [
    ['lodging', 'Lodging USD Cost: (per person)'],
    ['food', 'Food Estimate: (per person)'],
    ['excursions', 'Excursion(s) Cost: (per person)'],
    ['transport', 'Transportation Cost: (per person)'],
    ['points', 'Points Cost (per person)'],
];

/**
 * The meal a time of day implies.
 *
 * Her Restaurants table has a Meal column with a fixed vocabulary, and a
 * dinner reservation at 7pm should not arrive as a blank cell she has to fill
 * in for the fortieth time.
 */
export const mealFor = (time) => {
    const h = hourOf(time);
    if (h === null) return '';
    if (h < 11) return 'Breakfast';
    if (h < 15) return 'Brunch / Lunch';
    if (h < 17) return 'Drinks';
    return 'Dinner';
};

/**
 * The main tab: the template's own grid, filled in.
 *
 * `days` are the Atlas day rows in date order; `items` is keyed by day id.
 */
export const itineraryTab = (
    { days = [], items = {}, legs = [], stays = [], costs = {}, currency = 'USD' } = {}
) => {
    const dates = days.map((d) => String(d.date).slice(0, 10));
    const n = dates.length;
    // Labels, one column per day, then the three side columns from the template.
    const width = 1 + n + 3;
    const costByDate = Object.fromEntries((costs.days || []).map((d) => [String(d.date).slice(0, 10), d]));

    const rows = [];
    const merges = [];

    const put = (cells) => {
        const row = blankRow(width);
        cells.forEach((value, i) => { row[i] = value; });
        rows.push(row);
        return rows.length - 1;
    };

    /* ---- the three header rows ------------------------------------------ */

    put(['Date/Time', ...dates.map(dayLabel), 'Things to Do', 'Food', 'Other']);

    const cityFor = (date) => cityLabelOn(legs, date)
        || days.find((d) => String(d.date).slice(0, 10) === date)?.city
        || '';
    const cityRow = put(['City', ...dates.map(cityFor)]);

    const stayFor = (date) => {
        const stay = stays.find((s) => nightsOf(s).includes(date));
        if (stay) return stay.name || '';
        return days.find((d) => String(d.date).slice(0, 10) === date)?.lodging || '';
    };
    const lodgingRow = put(['Lodging', ...dates.map(stayFor)]);

    // City and Lodging merge across their runs — the whole reason those rows
    // were merged cells in the template rather than repeated text.
    for (const [rowIndex, values] of [[cityRow, dates.map(cityFor)], [lodgingRow, dates.map(stayFor)]]) {
        for (const run of runsOf(values)) {
            if (run.span > 1) merges.push({ row: rowIndex, col: 1 + run.start, rows: 1, cols: run.span });
        }
    }

    // The side headers span the three header rows, as they do in her sheet.
    for (let i = 0; i < 3; i += 1) {
        merges.push({ row: 0, col: 1 + n + i, rows: 3, cols: 1 });
    }

    /* ---- weather -------------------------------------------------------- */

    const weatherCell = (date) => {
        const w = days.find((d) => String(d.date).slice(0, 10) === date)?.weather;
        if (!w || w.high == null) return '';
        const low = w.low == null ? '' : ` / ${Math.round(w.low)}°`;
        // An average is not a forecast, and which one it is decides what goes
        // in the suitcase — so the sheet says so rather than implying certainty.
        const typical = w.source === 'normal' ? ' (typical)' : '';
        return `${Math.round(w.high)}°${low}${typical}`;
    };
    put(['Weather', ...dates.map(weatherCell)]);

    /* ---- the hour grid --------------------------------------------------- */

    for (const hour of HOURS) {
        const cells = dates.map((date) => {
            const day = days.find((d) => String(d.date).slice(0, 10) === date);
            const slot = (items[day?.id] || []).filter((i) => hourOf(i.start_time) === hour);
            return slot.map((i) => i.title).filter(Boolean).join('\n');
        });
        put([hourLabel(hour), ...cells]);
    }

    /* ---- anything without a time still has to land somewhere ------------- */

    const looseFor = (date) => {
        const day = days.find((d) => String(d.date).slice(0, 10) === date);
        return (items[day?.id] || []).filter((i) => hourOf(i.start_time) === null);
    };
    put(['Unscheduled', ...dates.map((d) => looseFor(d).map((i) => i.title).filter(Boolean).join('\n'))]);

    /* ---- the five cost lines and the running total ----------------------- */

    for (const [bucket, label] of COST_ROWS) {
        put([label, ...dates.map((d) => round(costByDate[d]?.buckets?.[bucket] || 0))]);
    }
    put(['Running Total Per Person:', ...dates.map((d) => round(costByDate[d]?.runningTotal || 0))]);

    return {
        name: 'Itinerary',
        rows,
        merges,
        // The label column carries long text; the day columns should be even.
        widths: [200, ...dates.map(() => 150), 200, 200, 200],
        freeze: { rows: 3, columns: 1 },
        money: {
            // Rows to format as currency, and in which currency.
            from: rows.length - COST_ROWS.length - 1,
            to: rows.length - 1,
            currency,
        },
    };
};

/** Everything planned as food, as the template's Restaurants table. */
export const restaurantsTab = ({ days = [], items = {} } = {}) => {
    const rows = [['Restaurant', 'Meal', 'Price', 'Cuisine', 'Neighborhood', 'Reservations?', "Neha's Rec", 'Notes']];

    for (const day of days) {
        for (const item of (items[day.id] || [])) {
            if (item.kind !== 'food') continue;
            rows.push([
                item.title || '', mealFor(item.start_time), round(item.cost || 0),
                '', '', '', '', `Planned ${dayLabel(day.date)}`,
            ]);
        }
    }

    // Room to keep adding, which is what the table is for.
    for (let i = 0; i < 12; i += 1) rows.push(blankRow(8));
    return { name: 'Restaurants', rows, merges: [], widths: [220, 130, 90, 130, 150, 130, 130, 300], freeze: { rows: 1, columns: 0 } };
};

/** Everything else planned, as the template's Things to Do table. */
export const thingsToDoTab = ({ days = [], items = {} } = {}) => {
    const rows = [['Things to Do', 'Location', 'Book?', 'Cost (USD)']];

    for (const day of days) {
        for (const item of (items[day.id] || [])) {
            if (item.kind === 'food' || item.kind === 'lodging') continue;
            rows.push([item.title || '', '', '', round(item.cost || 0)]);
        }
    }

    for (let i = 0; i < 12; i += 1) rows.push(blankRow(4));
    return { name: 'Things to Do', rows, merges: [], widths: [260, 200, 100, 120], freeze: { rows: 1, columns: 0 } };
};

/**
 * The whole workbook, ready to hand to the script.
 *
 * A stable `key` travels with it so re-exporting the same trip rewrites the
 * same spreadsheet instead of littering her Drive with a new copy every time
 * she changes a dinner reservation.
 */
export const sheetPayload = (trip, data) => ({
    key: `me-portal-trip-${trip?.id}`,
    title: `${trip?.destination || 'Trip'} — ${dayLabel(trip?.start_date)}`,
    currency: trip?.currency || 'USD',
    tabs: [itineraryTab({ ...data, currency: trip?.currency || 'USD' }), restaurantsTab(data), thingsToDoTab(data)],
});

/* ------------------------------------------------------------------------ *
 *  The other direction: an old sheet, read back into Atlas.
 * ------------------------------------------------------------------------ */

const isTime = (label) => /^\s*\d{1,2}:\d{2}\s*(am|pm)\s*$/i.test(String(label || ''));

/* A formula whose reference broke. It is not a city, a hotel, or a cost. */
const BROKEN = /^#(REF|N\/A|VALUE|NAME\?|DIV\/0)!?$/i;
const clean = (value) => {
    const text = String(value ?? '').trim();
    return BROKEN.test(text) ? '' : text;
};

/** "6:00 PM" -> "18:00". */
export const parseHour = (label) => {
    const m = /^\s*(\d{1,2}):(\d{2})\s*(am|pm)\s*$/i.exec(String(label || ''));
    if (!m) return null;
    let h = Number(m[1]) % 12;
    if (/pm/i.test(m[3])) h += 12;
    return `${String(h).padStart(2, '0')}:${m[2]}`;
};

/**
 * A date from whatever the header cell happens to say.
 *
 * Her older sheets have headers like "Sat Dec 16" with the year living only in
 * the tab name, so the year has to be supplied. Anything that does not resolve
 * is skipped rather than guessed: a column silently assigned to the wrong day
 * is worse than a column left out, because you will not notice it.
 */
export const parseDayHeader = (label, year) => {
    const text = String(label || '').trim();
    const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
    // A stray Excel serial formatted as a date lands in 1900, and a column
    // headed "10 Jan 1900" is a leftover, not a day of anyone's trip.
    if (iso) return Number(iso[1]) >= 1990 ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;

    if (!year) return null;

    // "Sat Dec 16" and "Dec 16" and "16 Dec" all turn up in her old sheets, so
    // find the month name wherever it sits and take the number beside it.
    const words = text.replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean);
    const at = words.findIndex((w) => MONTHS.some((m) => w.toLowerCase().startsWith(m.toLowerCase())));
    if (at < 0) return null;

    const named = [null, words[at], words[at + 1] ?? words[at - 1]];
    const month = MONTHS.findIndex((m) => named[1].toLowerCase().startsWith(m.toLowerCase()));
    if (month < 0) return null;
    const day = Number(named[2]);
    if (!day || day > 31) return null;
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * Read a grid in the template's shape back into Atlas entries.
 *
 * Returns days (date, city, lodging, the five costs) and items (day date,
 * time, title), plus a list of what could not be read — because an importer
 * that quietly drops half a sheet is how you end up trusting an itinerary that
 * is missing your flight.
 */
export const readSheet = (grid = [], { year } = {}) => {
    const rows = grid.filter((r) => Array.isArray(r));
    if (!rows.length) return { days: [], items: [], skipped: ['the sheet was empty'], hours: 0 };

    const skipped = [];
    const headerIndex = rows.findIndex((r) => String(r[0] || '').trim().toLowerCase().startsWith('date'));
    if (headerIndex < 0) {
        return {
            days: [], items: [], hours: 0,
            skipped: ['no row starting with "Date" — is this the itinerary tab?'],
        };
    }

    const header = rows[headerIndex];
    const columns = [];
    // Her headers say "Sat Dec 16" and keep the year nowhere, so a trip over
    // New Year would put January in the wrong year — and her India trip is
    // exactly that trip. A column that lands before the one to its left has
    // rolled over, so the year rolls with it.
    let currentYear = year;
    let previous = null;

    for (let c = 1; c < header.length; c += 1) {
        const label = String(header[c] || '').trim();
        if (!label) continue;
        // The template's side columns are not days and must not become them.
        if (/^(things to do|food|other|total|notes)$/i.test(label)) continue;

        let date = parseDayHeader(label, currentYear);
        if (date && previous && date < previous) {
            currentYear = Number(String(date).slice(0, 4)) + 1;
            date = parseDayHeader(label, currentYear);
        }
        if (!date) { skipped.push(`column "${label}"`); continue; }
        previous = date;
        columns.push({ index: c, date });
    }
    if (!columns.length) {
        return { days: [], items: [], hours: 0, skipped: [...skipped, 'no day columns could be read'] };
    }

    const rowLabelled = (test) => rows.find((r) => test(String(r[0] || '').trim().toLowerCase()));
    const cityRow = rowLabelled((l) => l === 'city' || l === 'primary city');
    const lodgingRow = rowLabelled((l) => l === 'lodging');

    const costRow = (bucket) => rows.find((r) => {
        const l = String(r[0] || '').trim().toLowerCase();
        return l.startsWith(bucket) && l.includes('per person');
    });

    const days = columns.map(({ index, date }) => {
        const money = (row) => {
            const raw = String(row?.[index] ?? '').replace(/[^0-9.-]/g, '');
            const n = Number(raw);
            return Number.isFinite(n) ? n : 0;
        };
        return {
            date,
            city: clean(cityRow?.[index]),
            lodging: clean(lodgingRow?.[index]),
            cost_lodging: money(costRow('lodging')),
            cost_food: money(costRow('food')),
            cost_excursions: money(costRow('excursion')),
            cost_transport: money(costRow('transport')),
            cost_points: money(costRow('points')),
        };
    });

    const items = [];
    // An activity that runs from 9 to 5 is one merged cell in the sheet, and a
    // merged cell reads back as the same text on every hour it covers. Emitting
    // one item per hour would turn a paragliding trip into nine paraglidings,
    // so a value identical to the hour above it in the same column is a
    // continuation, not a new plan.
    const running = new Map();

    for (const row of rows) {
        const label = String(row[0] || '').trim();
        const unscheduled = /^unscheduled$/i.test(label);
        if (!isTime(label) && !unscheduled) continue;
        const time = unscheduled ? null : parseHour(label);

        for (const { index, date } of columns) {
            const cell = clean(row[index]);
            if (!cell) { running.delete(index); continue; }
            if (running.get(index) === cell) continue;
            running.set(index, cell);

            // The second line of a cell is a detail, not a second plan:
            // "St. Beatus Caves / Lauterbrunnen", "S&J Brunch / 11-1".
            const title = cell.split('\n').map((t) => t.trim()).filter(Boolean).join(' — ');
            if (title) items.push({ date, start_time: time, title, kind: 'todo' });
        }
    }

    // How many rows are labelled with a clock time. This is the fingerprint of
    // the itinerary grid, and the only reliable way to tell it from her packing
    // tab — which also has a Date row and a Primary City row, over more days,
    // and so wins any contest decided on day count.
    const hours = rows.filter((r) => isTime(String(r[0] || '').trim())).length;

    return { days, items, skipped, hours };
};
