/**
 * The Repertoire: every dance she has choreographed, and every song in them.
 *
 * A set is one tutorial video made for one group at one event — "Malvika +
 * Nitin Wedding, Friends Dance". The songs in it are not typed in a second
 * time: they come from the same chapter list she already writes into the
 * YouTube description, so `chapters` is the one source and the songs are
 * read out of it.
 *
 * The chapter lists she writes look like this:
 *
 *   00:02 - Right Hand Video
 *   00:57 - Right Hand Tutorial
 *   01:00 - Sharara (Medium)
 *   09:28 - Dholi Taro Mix (Jersey Family Dance)
 *   10:13 - Dholi Taro Mix Slowed Down (Jersey Family Dance)
 *
 * The last word says which kind of section it is (the clip, the tutorial,
 * the slowed-down run); the bracket says either how hard it is or who
 * dances it. Lines without a timestamp ("Song 1: Maahi Ve") are ignored.
 */

const KINDS = [
    { re: /\s+slowed\s+down$/i, kind: 'slowed' },
    { re: /\s+tutorial$/i, kind: 'tutorial' },
    { re: /\s+(video|clip)$/i, kind: 'clip' },
];

const DIFFICULTY = ['easy', 'medium', 'hard'];

/** "1:02:03", "12:57", "0:31" → seconds. */
export const toSeconds = (stamp) => stamp
    .split(':')
    .map(Number)
    .reduce((total, part) => total * 60 + part, 0);

/** 75 → "1:15". */
export const fmtStamp = (seconds) => {
    const s = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

/**
 * One song's identity across sets. "Dhoom Again Remix" and "Dhoom Again"
 * are the same song done twice; "Masakali Remix" is Masakali.
 */
export const songKey = (title) => String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+(remix|mix)$/, '')
    .trim();

/** "Eli re Eli x Jalebi Baby x Iski Uski" → its three songs. */
export const mashupParts = (title) => String(title || '')
    .split(/\s+x\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);

/** What a bracket says: a difficulty, a must-do flag, or who dances it. */
const readNote = (note) => {
    const out = { difficulty: null, mandatory: false, group: null };
    if (!note) return out;
    const lower = note.toLowerCase();
    out.difficulty = DIFFICULTY.find((d) => new RegExp(`\\b${d}\\b`).test(lower)) || null;
    out.mandatory = /\bmandatory\b/.test(lower);
    if (!out.difficulty && !out.mandatory) out.group = note.trim();
    return out;
};

/**
 * The chapter list, read into songs in the order they first appear. Each song
 * carries the seconds where its clip, tutorial and slowed-down run start.
 */
export const parseChapters = (text) => {
    const songs = [];
    const byKey = new Map();
    for (const raw of String(text || '').split(/\r?\n/)) {
        const m = raw.match(/^\s*((?:\d{1,2}:)?\d{1,2}:\d{2})\s*[-–—:]?\s*(.+?)\s*$/);
        if (!m) continue;
        let title = m[2];
        let note = null;
        const bracket = title.match(/\s*\(([^)]*)\)\s*$/);
        if (bracket) {
            note = bracket[1];
            title = title.slice(0, bracket.index);
        }
        let kind = 'clip';
        for (const k of KINDS) {
            if (k.re.test(title)) {
                kind = k.kind;
                title = title.replace(k.re, '');
                break;
            }
        }
        title = title.trim();
        if (!title) continue;
        const key = songKey(title);
        let song = byKey.get(key);
        if (!song) {
            song = {
                title, clip_at: null, tutorial_at: null, slowed_at: null,
                difficulty: null, mandatory: false, group: null,
            };
            byKey.set(key, song);
            songs.push(song);
        }
        const at = toSeconds(m[1]);
        const slot = `${kind}_at`;
        if (song[slot] === null) song[slot] = at;
        const read = readNote(note);
        song.difficulty = song.difficulty || read.difficulty;
        song.mandatory = song.mandatory || read.mandatory;
        song.group = song.group || read.group;
    }
    return songs;
};

/** The YouTube id out of any of its link shapes, or null. */
export const videoId = (url) => {
    const s = String(url || '').trim();
    const m = s.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
};

/** A link that opens the video at a moment. Not YouTube? The link as given. */
export const watchAt = (url, seconds) => {
    const id = videoId(url);
    if (!id) return url || null;
    const t = Number.isFinite(seconds) && seconds > 0 ? `&t=${Math.floor(seconds)}s` : '';
    return `https://www.youtube.com/watch?v=${id}${t}`;
};

const LEVEL = { easy: 1, medium: 2, hard: 3 };

/**
 * Every song she has done, with every set it was in. A mashup counts toward
 * each of its songs, so "have I done Jalebi Baby?" finds the cousins' dance.
 * Most-done first; ties alphabetical.
 */
export const songIndex = (sets) => {
    const index = new Map();
    for (const set of sets || []) {
        for (const song of parseChapters(set.chapters)) {
            const parts = mashupParts(song.title);
            for (const part of parts) {
                const key = songKey(part);
                if (!key) continue;
                let entry = index.get(key);
                if (!entry) {
                    entry = { key, title: part, uses: [], difficulty: null };
                    index.set(key, entry);
                } else if (part.length < entry.title.length) {
                    // "Dhoom Again" over "Dhoom Again Remix": the song, not the cut.
                    entry.title = part;
                }
                entry.uses.push({
                    set_id: set.id,
                    event: set.event,
                    group: song.group || set.group_name,
                    performed_on: set.performed_on || null,
                    as: parts.length > 1 ? song.title : null,
                    clip: song.clip_at !== null ? watchAt(set.video_url, song.clip_at) : null,
                    tutorial: song.tutorial_at !== null ? watchAt(set.video_url, song.tutorial_at) : null,
                    slowed: song.slowed_at !== null ? watchAt(set.video_url, song.slowed_at) : null,
                });
                // The easiest she has ever taught it is the useful number.
                if (song.difficulty && (!entry.difficulty
                    || LEVEL[song.difficulty] < LEVEL[entry.difficulty])) {
                    entry.difficulty = song.difficulty;
                }
            }
        }
    }
    const list = [...index.values()];
    for (const e of list) {
        e.uses.sort((a, b) => String(b.performed_on || '').localeCompare(String(a.performed_on || '')));
        e.last = e.uses[0]?.performed_on || null;
    }
    return list.sort((a, b) => b.uses.length - a.uses.length || a.title.localeCompare(b.title));
};

/** Does a set or a song match what she typed in the search box? */
export const matches = (query, ...fields) => {
    const q = songKey(query);
    if (!q) return true;
    return fields.some((f) => songKey(f).includes(q));
};

export const BLANK_SET = {
    event: '', group_name: '', performed_on: '', video_url: '', chapters: '', notes: '',
};

/** The form as it stands → the row to write. Blanks are nulls. */
export const setFromForm = (form) => {
    const clean = (v) => {
        const s = String(v ?? '').trim();
        return s || null;
    };
    return {
        event: clean(form.event) || 'Untitled',
        group_name: clean(form.group_name),
        performed_on: clean(form.performed_on),
        video_url: clean(form.video_url),
        chapters: String(form.chapters || '').trim(),
        notes: clean(form.notes),
    };
};

export const formFromSet = (set) => ({
    event: set.event || '',
    group_name: set.group_name || '',
    performed_on: set.performed_on || '',
    video_url: set.video_url || '',
    chapters: set.chapters || '',
    notes: set.notes || '',
});
