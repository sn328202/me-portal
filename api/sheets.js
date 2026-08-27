import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

/**
 * The trip, as an actual spreadsheet file — both directions.
 *
 * The first version of this talked to an Apps Script she deployed under her own
 * Google account. Google refused to authorise it: not the usual "unverified
 * app, continue anyway" interstitial but a flat block with no way past it,
 * because the script wanted Drive and Sheets scopes. Getting round that means a
 * Cloud Console project and an OAuth consent screen, which is a far bigger
 * thing than the feature it was serving.
 *
 * A file needs nobody's permission. Google Sheets opens an .xlsx dropped into
 * Drive as a normal sheet, merges and all, and exports one back out through
 * File → Download. So the round trip is the same round trip; only the transport
 * changed, and this end of it can no longer be blocked by an account policy.
 *
 * Done on the server so a spreadsheet writer does not land in the browser
 * bundle for a feature used once a trip.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;

/** Rows in, .xlsx out, laid out exactly as the payload says. */
const build = async (body) => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Me Portal';
    wb.created = new Date();

    for (const tab of body.tabs || []) {
        // Excel forbids : \ / ? * [ ] in a sheet name and silently corrupts the
        // file rather than telling you.
        const sheet = wb.addWorksheet(String(tab.name || 'Sheet').replace(/[:\\/?*[\]]/g, '-').slice(0, 31));

        for (const row of tab.rows || []) sheet.addRow(row);

        for (const m of tab.merges || []) {
            try {
                sheet.mergeCells(m.row + 1, m.col + 1, m.row + m.rows, m.col + m.cols);
            } catch {
                // An overlapping merge is not worth losing the export over.
            }
        }

        (tab.widths || []).forEach((w, i) => {
            // ExcelJS counts width in characters, not pixels.
            if (w) sheet.getColumn(i + 1).width = Math.round(w / 7);
        });

        const width = (tab.rows || []).reduce((max, r) => Math.max(max, r.length), 0);

        sheet.getRow(1).font = { bold: true };
        sheet.getColumn(1).font = { bold: true };
        sheet.getColumn(1).alignment = { vertical: 'top', wrapText: true };
        for (let c = 2; c <= width; c += 1) {
            sheet.getColumn(c).alignment = { vertical: 'top', wrapText: true };
        }

        if (tab.freeze) {
            sheet.views = [{
                state: 'frozen',
                xSplit: tab.freeze.columns || 0,
                ySplit: tab.freeze.rows || 0,
            }];
        }

        if (tab.money && tab.money.to >= tab.money.from) {
            for (let r = tab.money.from + 1; r <= tab.money.to + 1; r += 1) {
                for (let c = 2; c <= width; c += 1) {
                    sheet.getCell(r, c).numFmt = '$#,##0.00';
                }
            }
        }
    }

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer).toString('base64');
};

/**
 * An .xlsx back into a grid of strings.
 *
 * Merged cells are the reason this is not three lines: a merged range carries
 * its value only in the top-left cell, so a City row merged across five days
 * would come back as one city and four blanks, and the import would lose four
 * days of where she was. Every merge is filled back in before the grid leaves.
 */
const read = (base64) => {
    const wb = new ExcelJS.Workbook();
    return wb.xlsx.load(Buffer.from(base64, 'base64')).then(() => ({
        tabs: wb.worksheets.map((sheet) => {
            const rows = [];
            const height = sheet.rowCount;
            const width = sheet.columnCount;

            for (let r = 1; r <= height; r += 1) {
                const row = [];
                for (let c = 1; c <= width; c += 1) {
                    const cell = sheet.getCell(r, c);
                    const value = cell.value;
                    if (value === null || value === undefined) { row.push(''); continue; }
                    if (typeof value === 'object') {
                        // Formulas carry a cached result; rich text carries runs.
                        if ('result' in value) row.push(String(value.result ?? ''));
                        else if ('richText' in value) row.push(value.richText.map((t) => t.text).join(''));
                        else if ('text' in value) row.push(String(value.text));
                        else if (value instanceof Date) row.push(value.toISOString().slice(0, 10));
                        else row.push('');
                        continue;
                    }
                    row.push(String(value));
                }
                rows.push(row);
            }

            // Spread each merge back across the cells it covers.
            for (const range of Object.values(sheet._merges || {})) {
                const model = range.model || range;
                const { top, left, bottom, right } = model;
                if (!top) continue;
                const value = rows[top - 1]?.[left - 1];
                if (!value) continue;
                for (let r = top; r <= bottom; r += 1) {
                    for (let c = left; c <= right; c += 1) {
                        if (rows[r - 1]) rows[r - 1][c - 1] = value;
                    }
                }
            }

            return { name: sheet.name, rows };
        }),
    }));
};

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') return res.status(405).json({ error: 'POST with a session.' });
    if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Not configured.' });
    }

    const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!bearer) return res.status(401).json({ error: 'Sign in first.' });
    const { data: auth, error: authError } = await sb.auth.getUser(bearer);
    if (authError || !auth?.user) return res.status(401).json({ error: 'That session has expired.' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

    try {
        if (body.action === 'export') {
            const file = await build(body);
            return res.status(200).json({ file, filename: `${(body.title || 'Itinerary').replace(/[^\w\s-]/g, '').trim() || 'Itinerary'}.xlsx` });
        }
        if (body.action === 'import') {
            if (!body.file) return res.status(400).json({ error: 'No file came through.' });
            const result = await read(body.file);
            if (!result.tabs.length) return res.status(400).json({ error: 'That file has no sheets in it.' });
            return res.status(200).json(result);
        }
        return res.status(400).json({ error: `Unknown action: ${body.action}` });
    } catch (err) {
        // A .numbers or an old .xls arrives here rather than as a crash.
        return res.status(400).json({
            error: /zip|signature|corrupt|end of central/i.test(String(err.message))
                ? 'That does not look like an .xlsx. In Google Sheets: File → Download → Microsoft Excel.'
                : err.message,
        });
    }
}
