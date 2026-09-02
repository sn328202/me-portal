import assert from 'node:assert/strict';
import { parseCsv, readTable, normaliseHeader, pick } from '../src/utils/csv.js';
import {
    readGoodreads, readLetterboxd, planImport, describePlan, isbnOf, bookCover,
} from '../src/utils/shelfImport.js';
import { sniff, readZip } from '../src/utils/shelfFiles.js';
import { zipSync, strToU8 } from 'fflate';
import { bestMatch } from '../api/covers.js';

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log(`  ok  ${name}`); };

/** A ZIP in memory, so the archive layout can be tested without one on disk. */
const zipOf = (files) => zipSync(
    Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)]))
);

console.log('reading a CSV somebody else wrote:');

t('a review with a comma in it is one field', () => {
    const [, row] = parseCsv('Title,My Review\nDune,"Long, and worth it"');
    assert.deepEqual(row, ['Dune', 'Long, and worth it']);
});

t('and a review with a line break in it is one field', () => {
    // This is the one that shreds a hand-rolled split: everything after it
    // is off by a row, and the file still looks like it imported.
    const rows = parseCsv('Title,My Review\nDune,"One.\nTwo."\nEmma,Short');
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[1], ['Dune', 'One.\nTwo.']);
    assert.deepEqual(rows[2], ['Emma', 'Short']);
});

t('a quote inside a quoted field is doubled, not escaped', () => {
    const [, row] = parseCsv('Title,My Review\nDune,"She said ""no"" twice"');
    assert.equal(row[1], 'She said "no" twice');
});

t('CRLF is a line ending, not a character in the last field', () => {
    const rows = parseCsv('Title,Year\r\nDune,1965\r\nEmma,1815\r\n');
    assert.deepEqual(rows, [['Title', 'Year'], ['Dune', '1965'], ['Emma', '1815']]);
});

t('a trailing newline is not an empty row', () => {
    assert.equal(parseCsv('a,b\n1,2\n').length, 2);
});

t('an empty field in the middle stays a field', () => {
    assert.deepEqual(parseCsv('a,b,c\n1,,3')[1], ['1', '', '3']);
});

t('a byte-order mark does not become part of the first header', () => {
    const { rows } = readTable('﻿Title,Year\nDune,1965');
    assert.equal(rows[0].title, 'Dune');
});

t('headers are matched however the year of the export spelled them', () => {
    assert.equal(normaliseHeader('Date Read'), 'date read');
    assert.equal(normaliseHeader('dateRead'), 'date read');
    assert.equal(normaliseHeader('Date_Read'), 'date read');
    assert.equal(normaliseHeader('  Letterboxd URI '), 'letterboxd uri');
});

t('pick takes the first column the file actually has', () => {
    const { rows } = readTable('Name,Year\nDune,2021');
    assert.equal(pick(rows[0], 'Title', 'Name'), 'Dune');
    assert.equal(pick(rows[0], 'Nothing', 'Missing'), '');
});

console.log('\na Goodreads export:');

const GOODREADS = [
    'Book Id,Title,Author,Author l-f,ISBN,ISBN13,My Rating,Average Rating,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Exclusive Shelf,My Review,Read Count',
    '234225,The Left Hand of Darkness,Ursula K. Le Guin,"Le Guin, Ursula K.",="0441478123",="9780441478125",5,4.07,304,1987,1969,2026/03/14,2026/01/02,"sci-fi, favourites",read,"Cold, and then not.",1',
    '6483624,Piranesi,Susanna Clarke,"Clarke, Susanna",="",="9781526622426",4,4.24,272,2020,2020,2026-05-02,2026-04-30,,read,"Two floors up.\nThe statues.",1',
    '11111,A Book She Has Not Read,Some Author,"Author, Some",="",="",0,3.9,300,2024,2024,,2026-06-01,,to-read,,0',
    '22222,Halfway Through,Another Author,"Author, Another",="",="",0,4.0,200,2023,2023,,2026-07-01,,currently-reading,,0',
    '33333,,No Title At All,"",="",="",3,3.0,100,2020,2020,2026-01-01,2026-01-01,,read,,1',
].join('\n');

const gr = readGoodreads(GOODREADS);

t('only the read shelf comes across', () => {
    assert.deepEqual(gr.items.map((b) => b.title),
        ['The Left Hand of Darkness', 'Piranesi']);
    assert.equal(gr.skipped.unread, 2);
    assert.equal(gr.skipped.untitled, 1);
});

t('the author is a person, not a sort key', () => {
    assert.equal(gr.items[0].creator, 'Ursula K. Le Guin');
});

t('and the sort key is unpicked when that is all there is', () => {
    const only = readGoodreads([
        'Book Id,Title,Author l-f,Exclusive Shelf,Date Read',
        '9,Kindred,"Butler, Octavia E.",read,2026-02-02',
    ].join('\n'));
    assert.equal(only.items[0].creator, 'Octavia E. Butler');
});

t("Excel's leading = is not part of the ISBN", () => {
    assert.equal(gr.items[0].isbn, '9780441478125');
    assert.equal(isbnOf({ isbn13: '="9781526622426"' }), '9781526622426');
    assert.equal(isbnOf({ isbn13: '=""', isbn: '=""' }), null, 'an empty one is no ISBN');
    assert.equal(isbnOf({ isbn: '="0441478123"' }), '0441478123', 'a 10 is still an ISBN');
    assert.equal(isbnOf({ isbn: '="12345"' }), null, 'and a fragment is not');
});

t('both date spellings Goodreads has used are dates', () => {
    assert.equal(gr.items[0].finished_at, '2026-03-14', 'slashes');
    assert.equal(gr.items[1].finished_at, '2026-05-02', 'dashes');
});

t('the original publication year beats this edition\'s', () => {
    // 1969, not the 1987 reprint. "When was this written" is the question a
    // year on a book card is answering.
    assert.equal(gr.items[0].year, 1969);
});

t('an unrated book is unrated, not nought stars', () => {
    const some = readGoodreads([
        'Book Id,Title,Exclusive Shelf,Date Read,My Rating',
        '1,Unrated,read,2026-01-01,0',
    ].join('\n'));
    assert.equal(some.items[0].rating, null);
});

t('a read date rescues a book whose shelf has drifted', () => {
    const odd = readGoodreads([
        'Book Id,Title,Exclusive Shelf,Date Read',
        '5,Finished Anyway,to-read,2026-04-04',
    ].join('\n'));
    assert.equal(odd.items.length, 1);
});

t('and it carries a link back to Goodreads', () => {
    assert.equal(gr.items[0].link, 'https://www.goodreads.com/book/show/234225');
    assert.equal(gr.items[0].source, 'goodreads');
    assert.equal(gr.items[0].source_id, '234225');
});

console.log('\na Letterboxd export:');

/*
 * Shaped like a real export, which is not what I first assumed.
 *
 * `watched.csv` and `ratings.csv` carry the FILM's URI; `diary.csv` and
 * `reviews.csv` carry that ENTRY's URI. On her actual export of 1,185 films,
 * watched and diary share exactly zero URIs — so keying on the URI turned
 * every diary entry into a second copy of a film she had already seen.
 */
const LB = {
    watched: [
        'Date,Name,Year,Letterboxd URI',
        '2026-01-10,Paddington 2,2017,https://boxd.it/film1',
        '2019-06-01,An Old One,2005,https://boxd.it/film4',
        '2026-03-01,Aftersun,2022,https://boxd.it/film2',
    ].join('\n'),
    diary: [
        'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date',
        '2026-02-02,Paddington 2,2017,https://boxd.it/entry77aaa,4.5,Yes,,2026-02-01',
        '2026-03-03,Aftersun,2022,https://boxd.it/entry77bbb,5,No,,2026-03-02',
    ].join('\n'),
    ratings: [
        'Date,Name,Year,Letterboxd URI,Rating',
        '2026-03-03,Aftersun,2022,https://boxd.it/film2,5',
        '2026-04-04,Portrait of a Lady on Fire,2019,https://boxd.it/film3,4',
    ].join('\n'),
    reviews: [
        'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Watched Date',
        '2025-08-03,Aftersun,2022,https://boxd.it/entry77ccc,5,No,"An older thought.",2025-08-02',
        '2026-03-04,Aftersun,2022,https://boxd.it/entry77bbb,5,No,"The last dance.",2026-03-02',
    ].join('\n'),
};

const lb = readLetterboxd(LB);
const film = (name) => lb.items.find((f) => f.title === name);

t('one film, however many files mention it', () => {
    // The bug this replaces: keyed on the URI, Paddington 2 appeared twice —
    // once from watched.csv and once from its diary entry, which carries a
    // different URI entirely.
    assert.equal(lb.items.filter((f) => f.title === 'Paddington 2').length, 1);
    assert.equal(lb.items.length, 4, 'four films across four files');
});

t('a diary entry is not a second copy of the film', () => {
    const seen = lb.items.map((f) => f.source_id);
    assert.equal(new Set(seen).size, seen.length, 'no key appears twice');
    assert.equal(lb.items.filter((f) => f.title === 'Aftersun').length, 1,
        'Aftersun is in watched, diary, ratings and reviews — and is one film');
});

t('the link goes to the film, not to her diary row', () => {
    // watched.csv and ratings.csv hold the film's URI; the other two hold the
    // entry's. A card opening her own diary row is a link that looks right
    // and goes somewhere else.
    assert.equal(film('Aftersun').link, 'https://boxd.it/film2');
    assert.equal(film('Paddington 2').link, 'https://boxd.it/film1');
    assert.equal(film('Portrait of a Lady on Fire').link, 'https://boxd.it/film3',
        'rated but never logged, so the link comes from ratings.csv');
});

t('a film watched twice keeps the newer review', () => {
    // Not "whichever came last in the file" — that assumes an ordering the
    // file does not promise.
    assert.equal(film('Aftersun').review, 'The last dance.');
});

t('and the bookkeeping does not leak out', () => {
    assert.equal('reviewedAt' in film('Aftersun'), false);
});

t('a film only in watched still comes across', () => {
    // Watched before she kept a diary. Leaving it out makes the Library
    // smaller than the truth.
    assert.equal(film('An Old One').finished_at, '2019-06-01');
});

t('the later viewing is the one remembered', () => {
    assert.equal(film('Paddington 2').finished_at, '2026-02-01');
});

t('the watch date beats the date it was logged', () => {
    assert.equal(film('Aftersun').finished_at, '2026-03-02');
});

t('half stars survive', () => {
    assert.equal(film('Paddington 2').rating, 4.5);
    assert.equal(film('Aftersun').rating, 5);
});

t('a rating with no diary entry is still a rating', () => {
    assert.equal(film('Portrait of a Lady on Fire').rating, 4);
});

t('the written review comes across', () => {
    assert.equal(film('Aftersun').review, 'The last dance.');
});

t('title and year are the key, because the URI is not the film', () => {
    assert.equal(film('Aftersun').source_id, 'aftersun|2022');
    assert.equal(film('Portrait of a Lady on Fire').source_id,
        'portrait of a lady on fire|2019');
});

t('accents and stray spacing do not split one film in two', () => {
    const odd = readLetterboxd({
        watched: 'Date,Name,Year,Letterboxd URI\n2026-01-01,Amélie,2001,https://boxd.it/f',
        ratings: 'Date,Name,Year,Letterboxd URI,Rating\n2026-01-02,Amelie,2001,https://boxd.it/f,5',
    });
    assert.equal(odd.items.length, 1);
    assert.equal(odd.items[0].rating, 5);
});

t('a missing file is not an error, just less known', () => {
    const thin = readLetterboxd({ watched: LB.watched });
    assert.equal(thin.items.length, 3);
    assert.equal(thin.items.every((f) => f.rating === null), true);
});

t('nothing at all is an empty shelf', () => {
    assert.deepEqual(readLetterboxd({}).items, []);
    assert.deepEqual(readLetterboxd().items, []);
});

t('newest first, so the preview opens on what she just watched', () => {
    const dates = lb.items.map((f) => f.finished_at).filter(Boolean);
    assert.deepEqual(dates, [...dates].sort().reverse());
});

console.log('\nwhat a second export would do:');

t('what is already here is an update, not a duplicate', () => {
    const existing = [
        { id: 'x', source: 'goodreads', source_id: '234225' },
        { id: 'y', source: 'letterboxd', source_id: 'aftersun|2022' },
    ];
    const plan = planImport([...gr.items, ...lb.items], existing);
    assert.equal(plan.update.length, 2);
    assert.equal(plan.update[0].id, 'x', 'the row it updates is the row that was there');
    assert.equal(plan.fresh.length, gr.items.length + lb.items.length - 2);
});

t('a shelf typed in by hand is never matched against', () => {
    // No source and no id: it cannot collide with an import, so it is left
    // exactly where it is.
    const plan = planImport(gr.items, [{ id: 'h', title: 'The Left Hand of Darkness' }]);
    assert.equal(plan.update.length, 0);
    assert.equal(plan.fresh.length, 2);
});

t('and it says what it is about to do in words', () => {
    assert.equal(describePlan({ fresh: [1, 2], update: [3] }), '2 new, 1 already here');
    assert.equal(describePlan({ fresh: [], update: [] }), 'nothing to bring in');
    assert.equal(describePlan({ fresh: [1] }, { unread: 300, untitled: 1 }),
        '1 new, 301 left behind');
});

console.log('\nfinding the right CSVs inside a real ZIP:');

t('deleted, orphaned, likes and lists are not her watch history', () => {
    // A real export has deleted/diary.csv, orphaned/diary.csv and
    // likes/films.csv sitting beside the genuine ones. Matched on the
    // basename alone, `likes/films.csv` IS the watched list and
    // `deleted/diary.csv` IS the diary — and which one won came down to the
    // order entries happened to sit in the archive.
    const zip = zipOf({
        'watched.csv': 'Date,Name,Year,Letterboxd URI\n2026-01-01,Real,2020,https://boxd.it/r',
        'diary.csv': 'Date,Name,Year,Letterboxd URI,Rating,Watched Date\n2026-01-02,Real,2020,https://boxd.it/e,4,2026-01-01',
        'deleted/diary.csv': 'Date,Name,Year,Letterboxd URI,Rating,Watched Date\n2020-01-01,Deleted,1999,https://boxd.it/x,1,2020-01-01',
        'orphaned/diary.csv': 'Date,Name,Year,Letterboxd URI\n2020-01-01,Orphaned,1999,https://boxd.it/y',
        'likes/films.csv': 'Date,Name,Year,Letterboxd URI\n2020-01-01,Merely Liked,1999,https://boxd.it/z',
        'lists/some-list.csv': 'Name,Year\nListed,1999',
    });
    const { files } = readZip(zip);
    const { items } = readLetterboxd(files);
    assert.deepEqual(items.map((f) => f.title), ['Real'], 'one film, and it is the real one');
    assert.equal(items[0].rating, 4, 'and the real diary was read, not the deleted one');
});

t('a dated wrapper folder is not depth that means anything', () => {
    // Older exports nest everything under letterboxd-<user>-<date>-utc/.
    const zip = zipOf({
        'letterboxd-neha-2026-09-02-utc/watched.csv':
            'Date,Name,Year,Letterboxd URI\n2026-01-01,Nested,2020,https://boxd.it/n',
        'letterboxd-neha-2026-09-02-utc/deleted/diary.csv':
            'Date,Name,Year,Letterboxd URI\n2020-01-01,Gone,1999,https://boxd.it/g',
    });
    const { items } = readLetterboxd(readZip(zip).files);
    assert.deepEqual(items.map((f) => f.title), ['Nested']);
});

console.log('\ntelling the two exports apart:');

t('a ZIP is Letterboxd, because Goodreads does not make one', () => {
    assert.equal(sniff('letterboxd-neha-2026-09-02-utc.zip', ''), 'letterboxd');
    assert.equal(sniff('renamed.ZIP', ''), 'letterboxd');
});

t('a CSV is told apart by a column only one of them has', () => {
    // Not by filename: both let you rename the download, and "export.csv" is
    // what a browser calls the second copy of anything.
    assert.equal(sniff('export.csv', GOODREADS), 'goodreads');
    assert.equal(sniff('export.csv', LB.diary), 'letterboxd-csv');
    assert.equal(sniff('shopping.csv', 'Item,Qty\nMilk,2'), null);
});

console.log('\nputting a poster on a film:');

t('the year decides which Dune', () => {
    // TMDB's first result is whichever is popular this week, which for a shelf
    // of things watched years ago is regularly the wrong film.
    const results = [
        { title: 'Dune', release_date: '2021-09-15', popularity: 900, id: 1 },
        { title: 'Dune', release_date: '1984-12-14', popularity: 50, id: 2 },
        { title: 'Dune: Part Two', release_date: '2024-02-27', popularity: 800, id: 3 },
    ];
    assert.equal(bestMatch(results, 'Dune', 1984).id, 2);
    assert.equal(bestMatch(results, 'Dune', 2021).id, 1);
});

t('a year one out still matches, because festivals', () => {
    const results = [{ title: 'Aftersun', release_date: '2022-11-18', popularity: 40, id: 7 }];
    assert.equal(bestMatch(results, 'Aftersun', 2023).id, 7);
});

t('and nothing convincing means nothing claimed', () => {
    const results = [{ title: 'A Different Film', release_date: '2001-01-01', id: 9 }];
    assert.equal(bestMatch(results, 'Aftersun', 2022), null);
    assert.equal(bestMatch([], 'Aftersun', 2022), null);
    assert.equal(bestMatch(undefined, 'Aftersun', 2022), null);
});

t('punctuation and accents are not the difference between two films', () => {
    const results = [{ title: 'Amélie', release_date: '2001-04-25', id: 4 }];
    assert.equal(bestMatch(results, 'Amelie', 2001).id, 4);
});

console.log('\ncovers that need nobody\'s permission:');

t('a book cover is a URL, not a lookup', () => {
    assert.equal(bookCover('9780441478125'),
        'https://covers.openlibrary.org/b/isbn/9780441478125-L.jpg?default=false');
});

t('and no ISBN is no cover, rather than a grey rectangle', () => {
    // default=false is what makes a missing cover a 404 the card can fall
    // back from, instead of Open Library's own placeholder.
    assert.equal(bookCover(null), null);
    assert.equal(gr.items[0].image_url.includes('default=false'), true);
});

console.log(`\nshelfImport: ${n} passed`);
