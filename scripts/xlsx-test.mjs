/**
 * The spreadsheet as a file, out and back.
 *
 * The layout is tested in sheet-test.mjs; this is about the file itself — that
 * a merged City band survives being written to .xlsx and read back, because
 * that is the one thing that silently loses four days of a trip if it doesn't.
 */

import ExcelJS from 'exceljs';
import { itineraryTab, readSheet, sheetPayload } from '../src/utils/tripSheet.js';
import { tripCost } from '../src/utils/tripCosts.js';

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

/* The same fixture the layout tests use, plus the travel leg she actually has. */
const legs = [
    { id: 'a', city: 'Air Travel', start_date: '2026-12-23', end_date: '2026-12-25' },
    { id: 'b', city: 'Mumbai', start_date: '2026-12-25', end_date: '2026-12-27' },
    { id: 'c', city: 'Kerala', start_date: '2026-12-27', end_date: '2026-12-29' },
];
const stays = [{ id: 's1', name: 'Taj Mahal Palace', check_in: '2026-12-25', check_out: '2026-12-27', cost: 800, cost_shared: true }];
const days = ['2026-12-23', '2026-12-24', '2026-12-25', '2026-12-26', '2026-12-27', '2026-12-28', '2026-12-29']
    .map((date, i) => ({ id: `d${i}`, date, weather: { high: 88, low: 70, code: 1, source: 'normal' } }));
const items = {
    d2: [
        { id: 'i1', title: 'Dinner at Masque', kind: 'food', start_time: '19:30:00', cost: 120, cost_shared: true },
        { id: 'i2', title: 'Visit the Taj', kind: 'todo', start_time: '10:00:00' },
    ],
    d3: [{ id: 'i3', title: 'Shopping in Colaba', kind: 'todo', start_time: null }],
};
const costs = tripCost(days, items, 2, stays);
const data = { days, items, legs, stays, costs, currency: 'USD' };

/* ---- write, exactly as api/sheets.js does ------------------------------- */

const write = async (payload) => {
    const wb = new ExcelJS.Workbook();
    for (const tab of payload.tabs) {
        const sheet = wb.addWorksheet(String(tab.name).replace(/[:\\/?*[\]]/g, '-').slice(0, 31));
        for (const row of tab.rows) sheet.addRow(row);
        for (const m of tab.merges || []) {
            try { sheet.mergeCells(m.row + 1, m.col + 1, m.row + m.rows, m.col + m.cols); } catch { /* overlap */ }
        }
    }
    return wb.xlsx.writeBuffer();
};

const back = async (buffer) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    return wb.worksheets.map((sheet) => {
        const rows = [];
        for (let r = 1; r <= sheet.rowCount; r += 1) {
            const row = [];
            for (let c = 1; c <= sheet.columnCount; c += 1) {
                const v = sheet.getCell(r, c).value;
                row.push(v === null || v === undefined ? '' : (typeof v === 'object' ? String(v.result ?? v.text ?? '') : String(v)));
            }
            rows.push(row);
        }
        for (const range of Object.values(sheet._merges || {})) {
            const { top, left, bottom, right } = range.model || range;
            const value = rows[top - 1]?.[left - 1];
            if (!value) continue;
            for (let r = top; r <= bottom; r += 1) {
                for (let c = left; c <= right; c += 1) if (rows[r - 1]) rows[r - 1][c - 1] = value;
            }
        }
        return { name: sheet.name, rows };
    });
};

console.log('\nthe file itself:');

const payload = sheetPayload({ id: 7, destination: 'India', start_date: '2026-12-23', currency: 'USD' }, data);
const buffer = await write(payload);

check('it is a real zip, which is what .xlsx is',
    Buffer.from(buffer).subarray(0, 2).toString('binary'), 'PK');
check('a fifteen-day trip is not a huge file', Buffer.from(buffer).length < 200000, true);

const tabs = await back(buffer);
check('all three tabs come back', tabs.map((t) => t.name), ['Itinerary', 'Restaurants', 'Things to Do']);

const grid = tabs[0].rows;
const row = (label) => grid.find((r) => r[0] === label);

check('the header survives', row('Date/Time').slice(1, 4), ['Wed Dec 23', 'Thu Dec 24', 'Fri Dec 25']);

// The whole reason the merge handling exists: without it these are three
// blanks and the import loses where she was on those days.
check('a merged city band comes back on every day it covers',
    row('City').slice(1, 4), ['Air Travel → Mumbai', 'Air Travel → Mumbai', 'Air Travel → Mumbai']);
// Dec 25 and 26 are Mumbai; the 27th is the handover into Kerala.
check('and the next band is its own',
    row('City').slice(3, 6), ['Air Travel → Mumbai', 'Mumbai', 'Mumbai → Kerala']);
check('merged lodging spreads too', row('Lodging').slice(3, 5), ['Taj Mahal Palace', 'Taj Mahal Palace']);

check('a timed thing keeps its slot', row('10:00 AM')[3], 'Visit the Taj');
check('an untimed thing is still there', row('Unscheduled')[4], 'Shopping in Colaba');

/* ---- and the grid still reads as an itinerary --------------------------- */

const parsed = readSheet(grid, { year: 2026 });
check('every day comes back', parsed.days.length, 7);
check('the cities came through the file intact',
    parsed.days.slice(0, 3).map((d) => d.city),
    ['Air Travel → Mumbai', 'Air Travel → Mumbai', 'Air Travel → Mumbai']);
check('the dinner survived the round trip',
    parsed.items.find((i) => i.title === 'Dinner at Masque')?.start_time, '19:00');
// $800 over two nights split two ways.
check('the money survived as a number',
    parsed.days.find((d) => d.date === '2026-12-25')?.cost_lodging, 200);
check('nothing was skipped', parsed.skipped, []);

/* An empty trip must not produce a broken file. */
const empty = await write(sheetPayload({ id: 8, destination: 'Nowhere', start_date: '' },
    { days: [], items: {}, legs: [], stays: [], costs: {} }));
check('a trip with no days still writes a file',
    Buffer.from(empty).subarray(0, 2).toString('binary'), 'PK');

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
