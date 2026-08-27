/**
 * The spreadsheet as a file, out and back.
 *
 * The layout is tested in sheet-test.mjs; this is about the file itself — that
 * a merged City band survives being written to .xlsx and read back, because
 * that is the one thing that silently loses four days of a trip if it doesn't.
 */

import { zipSync, strToU8 } from 'fflate';
import { buildXlsx, readXlsx, colName, safeName } from '../api/_xlsx.js';
import { readSheet, sheetPayload } from '../src/utils/tripSheet.js';
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

console.log('\nthe file itself:');

const payload = sheetPayload({ id: 7, destination: 'India', start_date: '2026-12-23', currency: 'USD' }, data);
const buffer = buildXlsx(payload);

check('it is a real zip, which is what .xlsx is',
    Buffer.from(buffer).subarray(0, 2).toString('binary'), 'PK');
check('a fifteen-day trip is not a huge file', buffer.length < 200000, true);

const { tabs } = readXlsx(buffer);
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
const empty = buildXlsx(sheetPayload({ id: 8, destination: 'Nowhere', start_date: '' },
    { days: [], items: {}, legs: [], stays: [], costs: {} }));
check('a trip with no days still writes a file',
    Buffer.from(empty).subarray(0, 2).toString('binary'), 'PK');
check('and it can be read back', readXlsx(empty).tabs.length, 3);

/* ---- the fiddly bits of the format ------------------------------------- */
console.log('\nthe bits of .xlsx that bite:');

// Excel columns are bijective base-26: after Z comes AA, not BA. A trip of
// three weeks is past column Z, so getting this wrong misplaces every cell.
check('column names past Z', [colName(0), colName(25), colName(26), colName(27), colName(51)],
    ['A', 'Z', 'AA', 'AB', 'AZ']);
check('a sheet name Excel would refuse is cleaned',
    safeName('Trip: Goa/Kerala [2026]', 0), 'Trip- Goa-Kerala -2026-');
check('a nameless sheet still gets a name', safeName('', 2), 'Sheet3');

// Ampersands and angle brackets in a restaurant name must not break the XML.
const awkward = buildXlsx({ tabs: [{ name: 'T', rows: [['Bar & Grill <the good one>', 'quote " here', 42]] }] });
const awkwardBack = readXlsx(awkward).tabs[0].rows[0];
check('an ampersand survives', awkwardBack[0], 'Bar & Grill <the good one>');
check('a quote survives', awkwardBack[1], 'quote " here');
check('a number stays a number, not a string', awkwardBack[2], '42');

// A wide trip proves the column maths past Z end to end.
const wide = buildXlsx({ tabs: [{ name: 'W', rows: [Array.from({ length: 30 }, (_, i) => `c${i}`)] }] });
check('thirty columns come back in order', readXlsx(wide).tabs[0].rows[0].slice(26, 29), ['c26', 'c27', 'c28']);

// Tabs are matched through the rels, so a reordered workbook still reads right.
const many = readXlsx(buildXlsx({ tabs: [{ name: 'One', rows: [['1']] }, { name: 'Two', rows: [['2']] }] }));
check('sheets keep their names and order', many.tabs.map((t) => t.name), ['One', 'Two']);

/* ---- what a real Google Sheets export looks like ------------------------ */
console.log('\nreading a sheet somebody else wrote:');

/**
 * Ours writes inline strings and plain text dates. Google writes a shared
 * string table and real date serials with a date number format — neither of
 * which our own files ever exercise, so they need a fixture.
 */
const foreign = (() => {
    const file = (body) => strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + body);
    return zipSync({
        '[Content_Types].xml': file('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
        'xl/workbook.xml': file(
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
            + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            + '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'),
        'xl/_rels/workbook.xml.rels': file(
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + '<Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
        // Style 1 is a date format; style 0 is not.
        'xl/styles.xml': file(
            '<styleSheet><numFmts><numFmt numFmtId="165" formatCode="d-mmm-yy"/></numFmts>'
            + '<cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="165"/></cellXfs></styleSheet>'),
        'xl/sharedStrings.xml': file(
            '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            + '<si><t>Date</t></si>'
            + '<si><t>Primary City</t></si>'
            + '<si><r><t>Flower </t></r><r><t>Mound</t></r></si>'   // rich text, in runs
            + '<si><t>Caf&amp;#233; &amp;amp; Bar</t></si>'
            + '</sst>'),
        'xl/worksheets/sheet1.xml': file(
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
            + '<row r="1"><c r="A1" t="s"><v>0</v></c>'
            // 46383 is 27 Dec 2026 as an Excel serial.
            + '<c r="B1" s="1"><v>46383</v></c><c r="C1" s="1"><v>46384</v></c></row>'
            + '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="s"><v>2</v></c></row>'
            + '<row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3" s="0"><v>1250.5</v></c></row>'
            + '</sheetData><mergeCells count="1"><mergeCell ref="B2:C2"/></mergeCells></worksheet>'),
    }, { mtime: new Date('2020-01-01T00:00:00Z') });
})();

const alien = readXlsx(foreign).tabs[0].rows;
check('shared strings resolve', alien[0][0], 'Date');
// Excel's day zero is 1899-12-30, because Lotus thought 1900 was a leap year.
check('a date serial becomes a date', alien[0].slice(1, 3), ['2026-12-27', '2026-12-28']);
check('rich text in runs is joined back up', alien[1][1], 'Flower Mound');
check('a plain number is not mistaken for a date', alien[2][1], '1250.5');
check('a merge in someone else\'s file spreads too', alien[1][2], 'Flower Mound');
check('escaped entities come back', alien[2][0], 'Caf&#233; &amp; Bar');

// And the whole point: it parses as an itinerary.
const foreignRead = readSheet(alien, { year: 2026 });
check('an alien sheet reads as days', foreignRead.days.map((d) => d.date), ['2026-12-27', '2026-12-28']);
check('with its city', foreignRead.days[0].city, 'Flower Mound');

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
