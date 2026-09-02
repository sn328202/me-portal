/**
 * The ideas board, as something you can paste into a message.
 *
 * The board is for planning; this is for asking. "Here are the six places I
 * found, which do you fancy" is a message, and the only way to send it was to
 * retype the board or screenshot it — a screenshot being the version nobody
 * can tap a link in.
 *
 * Plain text, deliberately. Not markdown, not HTML: it goes into WhatsApp, a
 * text message, an email, a Slack thread, and the only formatting all of those
 * agree on is a line break. A bare URL is the one thing every one of them
 * turns into something tappable.
 */

const clean = (s) => String(s ?? '').trim();

const HEADINGS = { do: 'Things to do', eat: 'Places to eat', stay: 'Places to stay' };

/**
 * The best link for an idea.
 *
 * The saved page beats the map: if she has kept a menu or a listing, that is
 * the thing worth opening, and a map link can be got from the name. Where
 * there is neither, the line is just the name — which is the point of the
 * "or just plain text if no link" in the ask.
 */
export const linkFor = (idea) => clean(idea?.url)
    || (idea?.place_id
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean(idea.title))}&query_place_id=${idea.place_id}`
        : '');

/** One idea, as a line. */
export const lineFor = (idea, currency = 'USD') => {
    const title = clean(idea?.title);
    if (!title) return '';

    /* The neighbourhood, and roughly what it costs — the two things somebody
       deciding between six options actually asks next. Anything longer than a
       line stops being a list. */
    const bits = [];
    if (clean(idea?.area)) bits.push(clean(idea.area));
    if (idea?.cost != null && idea.cost !== '') {
        const n = Number(idea.cost);
        if (Number.isFinite(n) && n > 0) {
            bits.push(`${currency === 'USD' ? '$' : ''}${n % 1 === 0 ? n : n.toFixed(2)}`);
        }
    }

    const where = bits.length ? ` (${bits.join(', ')})` : '';
    const link = linkFor(idea);
    return `• ${title}${where}${link ? `\n  ${link}` : ''}`;
};

/**
 * The whole board, ready to send.
 *
 * Promoted ideas are left out: they are already on a day, so they are not
 * options any more — sending them back as choices asks a question that has
 * been answered.
 *
 * An empty pile is omitted rather than printed with nothing under it, and if
 * every pile is empty the whole thing is empty, so a button can know there is
 * nothing to copy.
 */
export const ideasAsText = (ideas = [], { tripName, currency = 'USD' } = {}) => {
    const live = ideas.filter((i) => i && !i.promoted_at && clean(i.title));

    const blocks = ['do', 'eat', 'stay'].map((kind) => {
        const mine = live.filter((i) => (i.kind || 'do') === kind);
        if (!mine.length) return '';
        const lines = mine.map((i) => lineFor(i, currency)).filter(Boolean);
        if (!lines.length) return '';
        return `${HEADINGS[kind]}\n${lines.join('\n')}`;
    }).filter(Boolean);

    if (!blocks.length) return '';

    const title = clean(tripName);
    return [title ? `${title} — ideas` : 'Ideas', '', blocks.join('\n\n')].join('\n');
};

/** How many lines a copy would produce, for a button that says so. */
export const countable = (ideas = []) => ideas
    .filter((i) => i && !i.promoted_at && clean(i.title)).length;
