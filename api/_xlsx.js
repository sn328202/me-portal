import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

/**
 * .xlsx, written and read by hand.
 *
 * This started as two calls to ExcelJS. On her Mac — Node 23 — ExcelJS does not
 * merely fail, it *hangs on import*: the process sits there forever and even a
 * setTimeout never fires, which took a staged probe to find because nothing is
 * ever printed. That would have hung `npm test` before every deploy, and quite
 * possibly the serverless function too.
 *
 * An .xlsx is a zip of XML. fflate does the zip in about thirty synchronous
 * lines with no dependencies and no streams, and the XML we need is a small
 * subset: values, merges, column widths, frozen panes, bold, and a currency
 * format. Writing it out is more code than calling a library, but it is code
 * that cannot hang, has no version opinions, and is covered by a test that
 * writes a real file and reads it back.
 *
 * Deliberately not supported: charts, images, formulas we author (formulas
 * *read* from someone else's sheet come back as their cached value), and any
 * styling beyond the five cell formats below.
 */

/* ---- helpers ------------------------------------------------------------ */

const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Excel rejects most control characters outright and gives no clue why.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

/** 0 -> A, 25 -> Z, 26 -> AA. Excel columns are bijective base-26: there is no zero digit. */
export const colName = (index) => {
    let n = index + 1;
    let out = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        out = String.fromCharCode(65 + rem) + out;
        n = Math.floor((n - 1) / 26);
    }
    return out;
};

export const cellRef = (row, col) => `${colName(col)}${row + 1}`;

/** Excel counts a column's width in characters of the default font, not pixels. */
const charWidth = (pixels) => Math.max(4, Math.round(Number(pixels) / 7));

/* Zip entries need a timestamp; this one is arbitrary and deliberately fixed. */
const EPOCH = new Date('2020-01-01T00:00:00Z');

/* Style indexes, in the order they are written into styles.xml below. */
const S_WRAP = 2;
const S_BOLD_WRAP = 3;
const S_MONEY = 4;

/* ---- writing ------------------------------------------------------------ */

const sheetXml = (tab) => {
    const rows = tab.rows || [];
    const width = rows.reduce((max, r) => Math.max(max, r.length), 0);

    const money = tab.money && tab.money.to >= tab.money.from ? tab.money : null;
    const isMoneyRow = (r) => money && r >= money.from && r <= money.to;

    const cols = (tab.widths || []).length
        ? `<cols>${(tab.widths || []).map((w, i) => (w
            ? `<col min="${i + 1}" max="${i + 1}" width="${charWidth(w)}" customWidth="1"/>`
            : '')).join('')}</cols>`
        : '';

    const freeze = tab.freeze && (tab.freeze.rows || tab.freeze.columns)
        ? `<sheetViews><sheetView workbookViewId="0"><pane xSplit="${tab.freeze.columns || 0}"`
          + ` ySplit="${tab.freeze.rows || 0}"`
          + ` topLeftCell="${cellRef(tab.freeze.rows || 0, tab.freeze.columns || 0)}"`
          + ` activePane="bottomRight" state="frozen"/></sheetView></sheetViews>`
        : '';

    const body = rows.map((row, r) => {
        const cells = [];
        for (let c = 0; c < width; c += 1) {
            const value = row[c];
            if (value === '' || value === null || value === undefined) continue;

            const bold = r === 0 || c === 0;
            let style = bold ? S_BOLD_WRAP : S_WRAP;
            if (isMoneyRow(r) && c > 0) style = S_MONEY;

            const ref = cellRef(r, c);
            if (typeof value === 'number' && Number.isFinite(value)) {
                cells.push(`<c r="${ref}" s="${style}"><v>${value}</v></c>`);
            } else {
                // Inline strings, so there is no shared-string table to keep
                // in step with the cells that point into it.
                cells.push(`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`);
            }
        }
        return `<row r="${r + 1}">${cells.join('')}</row>`;
    }).join('');

    const merges = (tab.merges || []).filter((m) => m.rows > 0 && m.cols > 0 && (m.rows > 1 || m.cols > 1));
    const mergeXml = merges.length
        ? `<mergeCells count="${merges.length}">${merges.map((m) => (
            `<mergeCell ref="${cellRef(m.row, m.col)}:${cellRef(m.row + m.rows - 1, m.col + m.cols - 1)}"/>`
        )).join('')}</mergeCells>`
        : '';

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + freeze + cols
        + `<sheetData>${body}</sheetData>`
        // mergeCells must come after sheetData or Excel calls the file corrupt.
        + mergeXml
        + '</worksheet>';
};

const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/></numFmts>'
    + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
    + '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
    + '<fills count="2"><fill><patternFill patternType="none"/></fill>'
    + '<fill><patternFill patternType="gray125"/></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="5">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">'
    + '<alignment vertical="top" wrapText="1"/></xf>'
    + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">'
    + '<alignment vertical="top" wrapText="1"/></xf>'
    + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '</cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>';

/** Excel forbids : \ / ? * [ ] in a sheet name, and 31 characters is the cap. */
export const safeName = (name, index) => {
    const clean = String(name || `Sheet${index + 1}`).replace(/[:\\/?*[\]]/g, '-').slice(0, 31).trim();
    return clean || `Sheet${index + 1}`;
};

/** A workbook description in, a .xlsx as a Uint8Array out. */
export const buildXlsx = ({ tabs = [] } = {}) => {
    const sheets = tabs.length ? tabs : [{ name: 'Sheet1', rows: [] }];
    const names = sheets.map((t, i) => safeName(t.name, i));

    const files = {
        '[Content_Types].xml': strToU8(
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            + '<Default Extension="xml" ContentType="application/xml"/>'
            + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
            + '</Types>'
        ),
        '_rels/.rels': strToU8(
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            + '</Relationships>'
        ),
        'xl/workbook.xml': strToU8(
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
            + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            + `<sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>`
            + '</workbook>'
        ),
        'xl/_rels/workbook.xml.rels': strToU8(
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
            + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
            + '</Relationships>'
        ),
        'xl/styles.xml': strToU8(STYLES),
    };

    sheets.forEach((tab, i) => {
        files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(tab));
    });

    // A fixed timestamp, so the same trip produces byte-identical files and a
    // test can compare them. Zip timestamps must land in 1980-2099 anyway.
    return zipSync(files, { level: 6, mtime: EPOCH });
};

/* ---- reading ------------------------------------------------------------ */

const unescape = (s) => String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&');

/** All the <t> text inside a chunk, joined — rich text arrives as several runs. */
const textOf = (chunk) => {
    const parts = [];
    const re = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let m;
    while ((m = re.exec(chunk))) parts.push(unescape(m[1]));
    return parts.join('');
};

/**
 * Excel's day zero is 1899-12-30, not 1900-01-01, because Lotus 1-2-3 thought
 * 1900 was a leap year and every spreadsheet since has agreed to be wrong.
 */
const serialToDate = (serial) => {
    const n = Number(serial);
    if (!Number.isFinite(n) || n < 1) return null;
    const ms = Math.round((n - 25569) * 86400000);
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
};

const DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

/** Which style indexes mean "this number is really a date". */
const dateStyles = (stylesXml) => {
    const dateFmts = new Set(DATE_FORMATS);
    const fmtRe = /<numFmt[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g;
    let m;
    while ((m = fmtRe.exec(stylesXml || ''))) {
        const code = unescape(m[2]);
        // A format with y/d and no hour markers is a date; "0.00" is not.
        if (/[yd]/i.test(code.replace(/\[[^\]]*\]/g, '')) && !/^[#0.,%$\s"]*$/.test(code)) {
            dateFmts.add(Number(m[1]));
        }
    }

    const out = new Set();
    const block = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml || '');
    if (!block) return out;
    const xfRe = /<xf\b[^>]*numFmtId="(\d+)"[^>]*>|<xf\b[^>]*numFmtId="(\d+)"[^>]*\/>/g;
    let i = 0;
    let x;
    while ((x = xfRe.exec(block[1]))) {
        const id = Number(x[1] ?? x[2]);
        if (dateFmts.has(id)) out.add(i);
        i += 1;
    }
    return out;
};

const colIndex = (ref) => {
    const letters = /^([A-Z]+)/.exec(String(ref) || '');
    if (!letters) return 0;
    return letters[1].split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
};

/**
 * A .xlsx into tabs of string grids.
 *
 * Merged ranges are spread back across every cell they cover. Without that, a
 * City row merged across five days reads back as one city and four blanks, and
 * the import loses four days of where she was.
 */
export const readXlsx = (data) => {
    const files = unzipSync(data instanceof Uint8Array ? data : new Uint8Array(data));
    const text = (name) => (files[name] ? strFromU8(files[name]) : '');

    const shared = [];
    const sst = text('xl/sharedStrings.xml');
    if (sst) {
        const re = /<si>([\s\S]*?)<\/si>/g;
        let m;
        while ((m = re.exec(sst))) shared.push(textOf(m[1]));
    }

    const dated = dateStyles(text('xl/styles.xml'));

    // Sheet order and names live in workbook.xml; the file each one maps to
    // lives in the rels. Trusting sheet1.xml = the first sheet is wrong the
    // moment someone reorders tabs.
    const rels = {};
    const relRe = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
    let r;
    while ((r = relRe.exec(text('xl/_rels/workbook.xml.rels')))) {
        rels[r[1]] = r[2].replace(/^\/?xl\//, '');
    }

    const tabs = [];
    const sheetRe = /<sheet\b[^>]*\/>/g;
    let s;
    while ((s = sheetRe.exec(text('xl/workbook.xml')))) {
        const tag = s[0];
        const name = unescape((/name="([^"]*)"/.exec(tag) || [, ''])[1]);
        const rid = (/r:id="([^"]+)"/.exec(tag) || [, ''])[1];
        const target = rels[rid];
        const xml = target ? text(`xl/${target}`) : '';
        if (!xml) continue;

        const grid = [];
        const put = (row, col, value) => {
            while (grid.length <= row) grid.push([]);
            const line = grid[row];
            while (line.length <= col) line.push('');
            line[col] = value;
        };

        const rowRe = /<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
        let rowMatch;
        while ((rowMatch = rowRe.exec(xml))) {
            const rowIndex = Number(rowMatch[1]) - 1;
            const cellRe = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
            let cellMatch;
            while ((cellMatch = cellRe.exec(rowMatch[2]))) {
                const attrs = cellMatch[1];
                const inner = cellMatch[2] || '';
                const ref = (/r="([A-Z]+\d+)"/.exec(attrs) || [, ''])[1];
                if (!ref) continue;
                const type = (/t="([^"]+)"/.exec(attrs) || [, ''])[1];
                const style = Number((/s="(\d+)"/.exec(attrs) || [, ''])[1] || -1);

                let value = '';
                if (type === 'inlineStr') {
                    value = textOf(inner);
                } else if (type === 's') {
                    const idx = Number((/<v>([\s\S]*?)<\/v>/.exec(inner) || [, ''])[1]);
                    value = shared[idx] ?? '';
                } else if (type === 'str') {
                    // A formula's cached result.
                    value = unescape((/<v>([\s\S]*?)<\/v>/.exec(inner) || [, ''])[1]);
                } else {
                    const raw = (/<v>([\s\S]*?)<\/v>/.exec(inner) || [, ''])[1];
                    if (raw === '' || raw === undefined) value = '';
                    else if (dated.has(style)) value = serialToDate(raw) || raw;
                    else value = unescape(raw);
                }

                put(rowIndex, colIndex(ref), value);
            }
        }

        // Spread each merge across the cells it covers.
        const mergeRe = /<mergeCell[^>]*ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g;
        let mm;
        while ((mm = mergeRe.exec(xml))) {
            const left = colIndex(mm[1]);
            const top = Number(mm[2]) - 1;
            const right = colIndex(mm[3]);
            const bottom = Number(mm[4]) - 1;
            const value = grid[top]?.[left];
            if (!value) continue;
            for (let y = top; y <= bottom; y += 1) {
                for (let x = left; x <= right; x += 1) put(y, x, value);
            }
        }

        // Square it off, so a consumer can index any cell without guarding.
        const width = grid.reduce((max, line) => Math.max(max, line.length), 0);
        for (const line of grid) while (line.length < width) line.push('');

        tabs.push({ name, rows: grid });
    }

    return { tabs };
};
