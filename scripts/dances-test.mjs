/**
 * The Repertoire: reading a YouTube chapter list into songs, and the song
 * index across every set. The fixtures are her real descriptions.
 */

const {
    parseChapters, songIndex, songKey, mashupParts, watchAt, videoId, toSeconds, fmtStamp,
    setFromForm, matches,
} = await import('../src/utils/dances.js');
const { REPERTOIRE_SEED } = await import('../src/data/repertoireSeed.js');

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

console.log('timestamps');
check('mm:ss', toSeconds('12:57'), 777);
check('h:mm:ss', toSeconds('1:02:03'), 3723);
check('format', fmtStamp(777), '12:57');
check('format hours', fmtStamp(3723), '1:02:03');

console.log('video / tutorial pairs');
const nitin = parseChapters('00:02 - Shava Shava Video\n02:39 - Shava Shava Tutorial\n12:57 - Dum Dum Masta Hain Video\n13:58 - Dum Dum Masta Hain Tutorial');
check('two songs', nitin.map((s) => s.title), ['Shava Shava', 'Dum Dum Masta Hain']);
check('clip and tutorial times', [nitin[0].clip_at, nitin[0].tutorial_at], [2, 159]);

console.log('clip wording, and lines with no timestamp');
const dk = parseChapters('Song 1: Maahi Ve\nSong 2: Subha Hone Na De\n\n00:00 - Maahi Ve Clip\n00:59 - Maahi Ve Tutorial');
check('Song N lines skipped', dk.map((s) => s.title), ['Maahi Ve']);
check('clip at 0 kept', dk[0].clip_at, 0);

console.log('slowed down, and who dances it');
const sangeet = parseChapters('09:28 - Dholi Taro Mix (Jersey Family Dance)\n10:13 - Dholi Taro Mix Slowed Down (Jersey Family Dance)');
check('one song', sangeet.length, 1);
check('slowed time', sangeet[0].slowed_at, 613);
check('group from bracket', sangeet[0].group, 'Jersey Family Dance');
check('no difficulty', sangeet[0].difficulty, null);

console.log('difficulty and must-do');
const ns = parseChapters("00:00 - Pappu Can’t Dance (Easy)\n04:06 - Storm Trooper Mix (Easy - mandatory)\n01:00 - Sharara (Medium)");
check('easy', ns[0].difficulty, 'easy');
check('mandatory', [ns[1].difficulty, ns[1].mandatory, ns[1].group], ['easy', true, null]);
check('medium', ns[2].difficulty, 'medium');

console.log('one song, two names');
check('remix is the song', songKey('Dhoom Again Remix'), songKey('Dhoom Again'));
check('curly apostrophe', songKey('Pappu Can’t Dance'), songKey("Pappu Can't Dance"));
check('mashup parts', mashupParts('Eli re Eli x Jalebi Baby x Iski Uski'), ['Eli re Eli', 'Jalebi Baby', 'Iski Uski']);
check('not split inside a word', mashupParts('Maahi Ve'), ['Maahi Ve']);

console.log('links');
check('id from watch link', videoId('https://www.youtube.com/watch?v=qJZAMXstrsA'), 'qJZAMXstrsA');
check('id from short link', videoId('https://youtu.be/qJZAMXstrsA?si=x'), 'qJZAMXstrsA');
check('jump to a moment', watchAt('https://youtu.be/qJZAMXstrsA', 159), 'https://www.youtube.com/watch?v=qJZAMXstrsA&t=159s');
check('no moment', watchAt('https://youtu.be/qJZAMXstrsA'), 'https://www.youtube.com/watch?v=qJZAMXstrsA');
check('not youtube', watchAt('https://drive.google.com/x', 10), 'https://drive.google.com/x');

console.log('the index across her seven videos');
const sets = REPERTOIRE_SEED.map((s, i) => ({ id: String(i), ...s }));
const idx = songIndex(sets);
const find = (t) => idx.find((e) => e.key === songKey(t));
check('Gallan Goodiyan twice', find('Gallan Goodiyan').uses.length, 2);
check('Nachde Ne Saare twice', find('Nachde Ne Saare').uses.length, 2);
check('Maahi Ve twice', find('Maahi Ve').uses.length, 2);
check('Dhoom Again twice (one a remix)', find('Dhoom Again').uses.length, 2);
check('index shows the plain name', find('Dhoom Again').title, 'Dhoom Again');
check('Dhoom Again easiest is easy', find('Dhoom Again').difficulty, 'easy');
check('Jalebi Baby found in the mashup', find('Jalebi Baby').uses[0].as, 'Eli re Eli x Jalebi Baby x Iski Uski');
check('most-done first', idx[0].uses.length, 2);
check('newest use first', find('Gallan Goodiyan').uses.map((u) => u.event), ['Nishil + Swathi Sangeet', 'DK']);
check('tutorial link carries the time', find('Shava Shava').uses[0].tutorial, 'https://www.youtube.com/watch?v=qJZAMXstrsA&t=159s');
check('group from the song over the set', find('Chura Liya').uses[0].group, 'Mom + Dad Couples');

console.log('form and search');
check('blanks become nulls', setFromForm({ event: ' DK ', group_name: '', chapters: '' }), {
    event: 'DK', group_name: null, performed_on: null, video_url: null, chapters: '', notes: null,
});
check('search ignores case and punctuation', matches('gallan', 'Gallan Goodiyan'), true);
check('empty search matches all', matches('', 'anything'), true);

if (failed) {
    console.log(`\n${failed} failed`);
    process.exit(1);
}
console.log('\nall good');
