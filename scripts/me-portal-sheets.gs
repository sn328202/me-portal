/**
 * Me Portal — Google Sheets bridge
 * ================================
 *
 * Paste this into script.google.com, deploy it as a Web app, and give Me
 * Portal the /exec URL. It then does two things and nothing else:
 *
 *   export   receives a workbook (tabs, rows, merges) and writes it to a
 *            spreadsheet in your Drive, reusing the same file every time so
 *            re-exporting a trip does not litter Drive with copies
 *
 *   import   reads a spreadsheet you already have and hands the grid back
 *
 * It runs as YOU, under your own Google account, so there is no API key, no
 * OAuth client, and no credential of yours anywhere near the app.
 *
 * ---------------------------------------------------------------------------
 * SETUP  (about five minutes, once)
 * ---------------------------------------------------------------------------
 *
 *  1. Go to https://script.google.com and click "New project".
 *  2. Delete whatever is in the editor and paste this whole file in.
 *  3. Change SHARED_SECRET below to any phrase you like. It is what stops a
 *     stranger who guesses your URL from writing to your Drive.
 *  4. Click "Deploy" -> "New deployment".
 *       Type            Web app
 *       Execute as      Me
 *       Who has access  Anyone
 *     ("Anyone" is what lets the app reach it at all — the secret is what
 *      actually protects it.)
 *  5. Approve the permissions Google asks for. It will warn you the app is
 *     unverified; it is your own script, so continue.
 *  6. Copy the Web app URL. It ends in /exec.
 *  7. In Me Portal: Settings -> Google Sheets. Paste the URL and the secret.
 *
 * If you ever change this file, click Deploy -> Manage deployments -> edit ->
 * New version, or the URL will keep serving the old code.
 */

var SHARED_SECRET = 'change-me';

/* -------------------------------------------------------------------------- */

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (String(body.secret || '') !== SHARED_SECRET) {
      return reply({ error: 'That secret does not match the one in the script.' });
    }

    if (body.action === 'import') return reply(readWorkbook(body));
    if (body.action === 'export') return reply(writeWorkbook(body));
    return reply({ error: 'Unknown action: ' + body.action });
  } catch (err) {
    return reply({ error: String(err && err.message ? err.message : err) });
  }
}

function reply(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---- export --------------------------------------------------------------
 *
 * `key` is a stable id for the trip. It is stored in script properties against
 * the spreadsheet id, so the second export of a trip edits the first one's
 * file. If that file has since been deleted or moved to the bin, a new one is
 * made rather than the whole thing failing.
 */

function writeWorkbook(body) {
  var props = PropertiesService.getUserProperties();
  var key = 'sheet:' + (body.key || 'default');
  var id = props.getProperty(key);
  var ss = null;

  if (id) {
    try {
      ss = SpreadsheetApp.openById(id);
      if (DriveApp.getFileById(id).isTrashed()) ss = null;
    } catch (err) {
      ss = null;
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(body.title || 'Itinerary');
    props.setProperty(key, ss.getId());
  }

  ss.rename(body.title || ss.getName());

  var wanted = {};
  (body.tabs || []).forEach(function (tab) {
    wanted[tab.name] = true;
    writeTab(ss, tab);
  });

  // A sheet the export no longer produces is left alone rather than deleted:
  // anything you added by hand is yours, and this script is not entitled to
  // decide it was surplus.

  return {
    url: ss.getUrl(),
    id: ss.getId(),
    tabs: Object.keys(wanted)
  };
}

function writeTab(ss, tab) {
  var sheet = ss.getSheetByName(tab.name);
  if (!sheet) {
    sheet = ss.insertSheet(tab.name);
  } else {
    // Merges must go before the clear, or setValues throws on merged ranges
    // left over from a previous export with different city bands.
    sheet.getDataRange().breakApart();
    sheet.clear();
  }

  var rows = tab.rows || [];
  if (!rows.length) return;

  var width = 0;
  rows.forEach(function (r) { width = Math.max(width, r.length); });
  var padded = rows.map(function (r) {
    var out = r.slice();
    while (out.length < width) out.push('');
    return out;
  });

  sheet.getRange(1, 1, padded.length, width).setValues(padded);

  (tab.merges || []).forEach(function (m) {
    try {
      sheet.getRange(m.row + 1, m.col + 1, m.rows, m.cols).merge();
    } catch (err) {
      // A merge that overlaps another is not worth losing the export over.
    }
  });

  (tab.widths || []).forEach(function (w, i) {
    if (w) sheet.setColumnWidth(i + 1, w);
  });

  // The header row and the label column carry the structure, so they are the
  // two things worth making obvious.
  sheet.getRange(1, 1, 1, width).setFontWeight('bold');
  sheet.getRange(1, 1, padded.length, 1).setFontWeight('bold');
  sheet.getRange(1, 1, padded.length, width)
    .setVerticalAlignment('top')
    .setWrap(true);

  if (tab.freeze) {
    if (tab.freeze.rows) sheet.setFrozenRows(tab.freeze.rows);
    if (tab.freeze.columns) sheet.setFrozenColumns(tab.freeze.columns);
  }

  if (tab.money && tab.money.to >= tab.money.from) {
    var n = tab.money.to - tab.money.from + 1;
    sheet.getRange(tab.money.from + 1, 2, n, width - 1)
      .setNumberFormat('$#,##0.00');
  }
}

/* ---- import --------------------------------------------------------------
 *
 * Deliberately dumb: it returns the grid as strings and lets the app work out
 * what any of it means. Parsing an itinerary inside a script nobody can test
 * is how an importer quietly puts January in the wrong year.
 */

function readWorkbook(body) {
  var id = extractId(body.url || '');
  if (!id) return { error: 'That does not look like a Google Sheets link.' };

  var ss;
  try {
    ss = SpreadsheetApp.openById(id);
  } catch (err) {
    return { error: 'Could not open that sheet. Is it in this Google account?' };
  }

  var sheets = ss.getSheets();
  var wanted = body.tab
    ? sheets.filter(function (s) { return s.getName() === body.tab; })
    : sheets;
  if (!wanted.length) return { error: 'No tab named ' + body.tab };

  return {
    title: ss.getName(),
    url: ss.getUrl(),
    tabs: wanted.map(function (sheet) {
      var range = sheet.getDataRange();
      var values = range.getDisplayValues();

      // A merged cell reports its value only in its top-left corner, so a City
      // row merged across five days would come back as one city and four
      // blanks — and the import would lose four days of where you were.
      sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns())
        .getMergedRanges()
        .forEach(function (m) {
          var r = m.getRow() - 1;
          var c = m.getColumn() - 1;
          var value = values[r] ? values[r][c] : '';
          if (!value) return;
          for (var i = 0; i < m.getNumRows(); i += 1) {
            for (var j = 0; j < m.getNumColumns(); j += 1) {
              if (values[r + i]) values[r + i][c + j] = value;
            }
          }
        });

      return { name: sheet.getName(), rows: values };
    })
  };
}

function extractId(url) {
  var m = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(String(url));
  if (m) return m[1];
  // A bare id pasted in is a reasonable thing to do.
  if (/^[a-zA-Z0-9-_]{25,}$/.test(String(url).trim())) return String(url).trim();
  return null;
}

/* Handy for checking the deployment is alive from a browser. */
function doGet() {
  return ContentService
    .createTextOutput('Me Portal sheets bridge is running.')
    .setMimeType(ContentService.MimeType.TEXT);
}
