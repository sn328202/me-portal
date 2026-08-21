import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';
import { extractRecipe, parseIngredient } from './_recipe.js';
import { extractProduct } from './_link.js';
import { resolvePlace } from './_place.js';

/**
 * POST /api/capture   { text: "..." }
 * Header: x-capture-token: <CAPTURE_TOKEN>
 *
 * Takes one spoken thought, routes it to the right room of the portal, writes
 * it, and returns a one-line summary for the Shortcut's notification.
 *
 * Env (all server-side only — none of these are VITE_ prefixed, so none of
 * them reach the browser):
 *   ANTHROPIC_API_KEY          required
 *   ANTHROPIC_MODEL            optional, defaults to claude-sonnet-5
 *   SUPABASE_URL               required (same project, no VITE_ prefix)
 *   SUPABASE_SERVICE_ROLE_KEY  required — bypasses RLS, so every write here
 *                              sets user_id explicitly and never trusts input
 *   PORTAL_USER_ID             required — the account captures belong to
 *   CAPTURE_TOKEN              required — shared secret with the Shortcut
 */

/**
 * A capture can involve a web search, a page fetch and up to three model turns.
 * Vercel's default ceiling is 10 seconds, which a slow shop alone can spend.
 */
export const config = { maxDuration: 60 };

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const MAX_TEXT = 4000;

/**
 * Anthropic runs this one itself — no implementation on our side, the results
 * come back inside the same response. It exists so that "I want that matte
 * black Hario kettle" can become a real product page rather than a bare title.
 *
 * Billed per search ($10/1000), so `max_uses` is deliberately tight and the
 * system prompt restricts it to the one case that needs it.
 */
const WEB_SEARCH = {
    // Not 20260318: that revision runs inside a code-execution container, so
    // the follow-up turn is rejected with "container_id is required when there
    // are pending tool uses". This one has no such requirement.
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: 3,
    user_location: {
        type: 'approximate',
        city: 'San Francisco',
        region: 'California',
        country: 'US',
        timezone: 'America/Los_Angeles',
    },
};

const db = () =>
    createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

// Supabase hands back several error shapes — PostgrestError, a fetch failure,
// or a bare object. Reading `.message` alone yields "undefined" for some of
// them, which is how a real failure ended up reported as nothing at all.
const errText = (e) => {
    if (!e) return null;
    if (typeof e === 'string') return e;
    const parts = [e.message, e.details, e.hint, e.code && `code ${e.code}`].filter(Boolean);
    return parts.length ? parts.join(' | ') : JSON.stringify(e).slice(0, 300);
};

// Both sides get trimmed. Env-var panels and copy-paste add trailing
// newlines and spaces constantly, and a token that is right except for an
// invisible \n is the single most likely reason this ever fails.
const compareToken = (given) => {
    const g = String(given || '').trim();
    const e = String(process.env.CAPTURE_TOKEN || '').trim();
    const ok =
        g.length > 0 &&
        e.length > 0 &&
        g.length === e.length &&
        timingSafeEqual(Buffer.from(g), Buffer.from(e));
    return {
        ok,
        // Lengths only — never the values. Enough to tell "invisible
        // whitespace" apart from "two different secrets" without a guessing game.
        givenLengthRaw: String(given || '').length,
        givenLength: g.length,
        expectedLength: e.length,
        sameLength: g.length === e.length,
    };
};

/* ---------- what the model is allowed to do -------------------------- */

const TOOLS = [
    {
        name: 'add_groceries',
        description:
            'Add one or more items to the grocery list (Provisions). Use for anything that needs buying at a shop for the kitchen.',
        input_schema: {
            type: 'object',
            properties: { items: { type: 'array', items: { type: 'string' } } },
            required: ['items'],
        },
    },
    {
        name: 'add_todo',
        description:
            'Add a task. Use for anything actionable that is not shopping, a chore with a room, or a habit.',
        input_schema: {
            type: 'object',
            properties: { items: { type: 'array', items: { type: 'string' } } },
            required: ['items'],
        },
    },
    {
        name: 'add_desire',
        description:
            'Add something she wants to buy to the Treasury (a desire ledger, not a shopping list). Use for objects, clothes, furniture, jewellery — things wanted rather than needed. Always try to include `link`: the page is fetched and the real name, price, photo, brand and description are read off it, so anything you pass alongside a link is only a fallback. If she did not give a link, use web_search to find the product first — see the Treasury rules in the system prompt.',
        input_schema: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                link: {
                    type: 'string',
                    description: 'Direct URL to the product page. Prefer the brand\'s own site over a marketplace or reseller.',
                },
                category: {
                    type: 'string',
                    enum: ['Home', 'Kitchen', 'Closet', 'Books', 'Tech', 'Personal Care', 'Other'],
                    description: 'Must be one of these — the Treasury groups by category and anything else is invisible.',
                },
                price: { type: 'string', description: 'Number only, no currency symbol. Only if she said it; the page is more reliable.' },
                priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
            },
            required: ['title'],
        },
    },
    {
        name: 'save_spot',
        description:
            'Save a place she wants to go — a restaurant, bar, cafe, museum, park, hike, shop or venue. This is the default for any "I want to go to..." or "I want to try..." thought. The real place is looked up automatically, so pass the name as she said it and let the lookup supply the address, neighbourhood, map link, rating and hours. Do NOT use add_to_itinerary for this: a place she wants to go does not belong to any particular day yet.',
        input_schema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'The place as she named it.' },
                city: { type: 'string', description: 'City or neighbourhood, if she said one or it is obvious. Helps the lookup find the right branch.' },
                why: { type: 'string', description: 'Her reason, in her own words — "Ali said the tasting menu is worth it", "good for a rainy afternoon". Keep it verbatim; omit if she gave none.' },
                category: {
                    type: 'string',
                    enum: ['restaurant', 'bar', 'cafe', 'museum', 'park', 'hike', 'shop', 'venue', 'wellness', 'lodging', 'other'],
                    description: 'Only if the lookup is unlikely to work it out. It usually will.',
                },
                tags: { type: 'array', items: { type: 'string' }, description: 'Occasion tags she implied: date night, with friends, solo, brunch, birthday.' },
            },
            required: ['name'],
        },
    },
    {
        name: 'add_to_itinerary',
        description:
            'Put something on a specific day itinerary. Use ONLY when she is planning an actual day — she named a date, said "for Saturday", or referred to an itinerary that already exists. A place she merely wants to visit someday is a spot, not an itinerary item: use save_spot instead. Items with no fixed time go in as brainstorm entries.',
        input_schema: {
            type: 'object',
            properties: {
                plan_id: { type: 'string', description: 'Existing itinerary id to add to. Omit to create a new one.' },
                new_plan_title: { type: 'string', description: 'Title for a new itinerary, if plan_id is omitted.' },
                new_plan_location: { type: 'string' },
                new_plan_date: { type: 'string', description: 'YYYY-MM-DD, only if she named a date.' },
                activity: { type: 'string' },
                location: { type: 'string' },
                notes: { type: 'string' },
                start_time: { type: 'string', description: 'HH:MM 24h, only if she named a time.' },
            },
            required: ['activity'],
        },
    },
    {
        name: 'add_trip',
        description: 'Add a trip to The Atlas. Use for travel to another city or country, as opposed to a day out.',
        input_schema: {
            type: 'object',
            properties: {
                destination: { type: 'string' },
                status: { type: 'string', enum: ['Dreaming', 'Planned', 'Completed'] },
                start_date: { type: 'string' },
                notes: { type: 'string' },
            },
            required: ['destination'],
        },
    },
    {
        name: 'add_library_item',
        description:
            'Add something to read, watch, listen to or play to The Library. NOT for recipes — those belong in the Larder, use import_recipe or add_recipe.',
        input_schema: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                creator: { type: 'string' },
                type: {
                    type: 'string',
                    enum: ['Book', 'Movie', 'TV Show', 'Album', 'Game'],
                    description: 'Must be exactly one of these — the Library has a tab per type and anything else is invisible.',
                },
                status: { type: 'string', enum: ['Not Started', 'In Progress', 'Completed', 'Dropped'] },
            },
            required: ['title', 'type'],
        },
    },
    {
        name: 'add_social_plan',
        description: 'Add a plan involving other people to the Social Register.',
        input_schema: {
            type: 'object',
            properties: {
                who: { type: 'string' },
                what: { type: 'string' },
                when_date: { type: 'string', description: 'YYYY-MM-DD if known.' },
                where_loc: { type: 'string' },
            },
            required: ['who', 'what'],
        },
    },
    {
        name: 'add_chore',
        description: 'Add a household chore, which always belongs to a room.',
        input_schema: {
            type: 'object',
            properties: {
                text: { type: 'string' },
                room: { type: 'string', description: 'Reuse an existing room name when one fits.' },
            },
            required: ['text', 'room'],
        },
    },
    {
        name: 'add_goal',
        description: 'Add an aspiration with a time horizon.',
        input_schema: {
            type: 'object',
            properties: {
                text: { type: 'string' },
                horizon: { type: 'string', enum: ['week', 'month', 'year', 'life'] },
            },
            required: ['text', 'horizon'],
        },
    },
    {
        name: 'add_habit',
        description: 'Add a daily ritual she wants to track a streak for. Only when she clearly means a recurring daily practice.',
        input_schema: {
            type: 'object',
            properties: { text: { type: 'string' } },
            required: ['text'],
        },
    },
    {
        name: 'import_recipe',
        description:
            'Import a recipe into the Larder from a web link. Use whenever she gives a URL to a recipe — the page is fetched and the ingredients, instructions and timings are pulled out automatically. Strongly preferred over add_recipe when a link exists.',
        input_schema: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'The recipe page URL.' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Optional extra tags, e.g. Weeknight, Vegetarian.' },
            },
            required: ['url'],
        },
    },
    {
        name: 'add_recipe',
        description:
            'Add a recipe to the Larder without a link — dictated from memory, or named without a URL. If she names a recipe from a site (New York Times Cooking, Serious Eats) but gives no link, use this and leave ingredients empty; she can share the link later to fill it in.',
        input_schema: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                ingredients: {
                    type: 'array',
                    description: 'Only what she actually said. Plain lines like "2 cups flour" are fine.',
                    items: { type: 'string' },
                },
                instructions: { type: 'string' },
                servings: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
                source: { type: 'string', description: 'Where it came from, e.g. "New York Times Cooking".' },
            },
            required: ['title'],
        },
    },
    {
        name: 'nothing_to_file',
        description:
            'Use when the text contains nothing worth filing — a false start, a stray recording, or something with no home in the portal. Say why in one short clause.',
        input_schema: {
            type: 'object',
            properties: { because: { type: 'string' } },
            required: ['because'],
        },
    },
    {
        name: 'add_pantry_item',
        description: 'Record that an ingredient is now in the pantry, or add a new ingredient to the pantry catalogue.',
        input_schema: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                category: { type: 'string', description: 'e.g. Produce, Pantry, Dairy, Spice' },
                in_stock: { type: 'boolean' },
            },
            required: ['name'],
        },
    },
];

/* ---------- context: what already exists ------------------------------ */

/**
 * Spoken language and stored text rarely match character for character:
 * "lemons" against "lemon", "the ricotta" against "ricotta", "Oat Milk"
 * against "oat milk". All duplicate comparison happens on this normalised
 * form, so the check survives plurals, articles, case and punctuation.
 */
const norm = (s) => {
    let t = String(s || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]+/g, ' ')
        .replace(/\b(a|an|the|some|more|of|my|our|any)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Crude singularisation. Wrong on a handful of irregulars, right on a
    // grocery list, which is the only place duplicates actually happen.
    t = t
        .replace(/\b(\w{3,}?)ies\b/g, '$1y')
        .replace(/\b(\w{2,}?(?:s|x|z|ch|sh|o))es\b/g, '$1')
        .replace(/\b(\w{3,}?)s\b/g, (m, stem) => (/[sui]$/.test(stem) ? m : stem));

    return t;
};

const setOf = (values) => new Set((values || []).map(norm).filter(Boolean));

/**
 * Everything already in the portal that could make this capture a duplicate,
 * or that it could attach to instead of creating a fifth near-identical row.
 *
 * Two consumers: the system prompt (so the model can *choose* to attach), and
 * ctx.index (so the writer can *enforce* it regardless of what the model chose).
 */
async function loadContext(sb, userId) {
    const q = (table, cols, opts = {}) => {
        let query = sb.from(table).select(cols).eq('user_id', userId);
        if (opts.where) query = query.eq(opts.where[0], opts.where[1]);
        return query.order('created_at', { ascending: false }).limit(opts.limit || 40);
    };

    const [
        plans, planItems, trips, treasury, library,
        chores, pantry, provisions, todos, goals, habits, social, recipes, spots,
    ] = await Promise.all([
        q('day_plans', 'id, title, location, planned_date', { limit: 25 }),
        q('plan_items', 'plan_id, activity', { limit: 150 }),
        q('atlas_trips', 'id, destination, status', { limit: 30 }),
        q('treasury_items', 'id, title, category', { limit: 60 }),
        q('library_items', 'id, title, type, status', { limit: 80 }),
        q('chores', 'room', { limit: 60 }),
        q('pantry_ingredients', 'name, label, in_stock', { limit: 120 }),
        q('provisions', 'text', { where: ['checked', false], limit: 80 }),
        q('todos', 'text', { where: ['completed', false], limit: 60 }),
        q('goals', 'text, horizon', { limit: 40 }),
        q('habits', 'text', { limit: 40 }),
        q('social_plans', 'who, what, when_date', { limit: 30 }),
        q('recipes', 'title, source_url', { limit: 80 }),
        q('spots', 'name, city, category, status, place_id', { limit: 120 }),
    ]);

    // A single failed sub-query must not take the whole capture down; the
    // endpoint should still file the thought, just with less to compare against.
    const rows = (r) => (r && !r.error && Array.isArray(r.data) ? r.data : []);
    const uniq = (r, key) => [...new Set(rows(r).map((x) => x[key]).filter(Boolean))];

    const itemsByPlan = {};
    rows(planItems).forEach((it) => {
        if (!it.plan_id) return;
        (itemsByPlan[it.plan_id] = itemsByPlan[it.plan_id] || []).push(it.activity);
    });

    const ctx = {
        itineraries: rows(plans).map((p) => ({
            id: p.id,
            title: p.title,
            location: p.location,
            date: p.planned_date,
            items: (itemsByPlan[p.id] || []).slice(0, 8),
        })),
        trips: rows(trips).map((t) => ({ id: t.id, destination: t.destination, status: t.status })),
        treasury: rows(treasury).map((t) => ({ title: t.title, category: t.category })),
        treasuryCategories: uniq(treasury, 'category'),
        library: rows(library).map((l) => ({ title: l.title, type: l.type, status: l.status })),
        rooms: uniq(chores, 'room'),
        pantry: rows(pantry).filter((p) => p.in_stock !== false).map((p) => p.label || p.name),
        groceries: uniq(provisions, 'text'),
        todos: uniq(todos, 'text'),
        goals: rows(goals).map((g) => `${g.text}${g.horizon ? ` (${g.horizon})` : ''}`),
        habits: uniq(habits, 'text'),
        social: rows(social).map((s) => `${s.what} with ${s.who}`),
        recipes: uniq(recipes, 'title'),
        spots: rows(spots).map((sp) => ({
            name: sp.name, city: sp.city, category: sp.category, status: sp.status,
        })),
    };

    // The enforceable half. Keyed by table name so the writer can look up
    // `ctx.index[table]` without a second mapping to keep in sync.
    ctx.index = {
        provisions: setOf(ctx.groceries),
        todos: setOf(ctx.todos),
        treasury_items: setOf(ctx.treasury.map((t) => t.title)),
        library_items: setOf(ctx.library.map((l) => l.title)),
        atlas_trips: setOf(ctx.trips.map((t) => t.destination)),
        habits: setOf(ctx.habits),
        goals: setOf(rows(goals).map((g) => g.text)),
        pantry_ingredients: setOf(rows(pantry).map((p) => p.name)),
        social_plans: setOf(ctx.social),
        recipes: setOf(ctx.recipes),
        spots: setOf(ctx.spots.map((sp) => sp.name)),
        // Google's identifier survives her calling the same place three
        // different things.
        spotPlaceIds: new Set(rows(spots).map((sp) => sp.place_id).filter(Boolean)),
        // Same dish saved twice from the same page is the likeliest repeat,
        // and titles drift between imports where the URL does not.
        recipeUrls: new Set(rows(recipes).map((r) => r.source_url).filter(Boolean)),
        planItems: Object.fromEntries(
            Object.entries(itemsByPlan).map(([id, list]) => [id, setOf(list)])
        ),
    };

    return ctx;
}

/**
 * The duplicate guard. The model is *told* what already exists, but being told
 * is not the same as complying, and two captures seconds apart can race each
 * other. This is the part that actually holds: nothing is written if its
 * normalised form is already present, and anything skipped is reported rather
 * than silently dropped.
 */
const dedupe = (ctx, key, values, where, dupes) => {
    const seen = ctx.index[key] || (ctx.index[key] = new Set());
    const fresh = [];
    for (const value of values || []) {
        const n = norm(value);
        if (!n) continue;
        if (seen.has(n)) {
            dupes.push({ item: value, where });
            continue;
        }
        // Added before the insert, so a repeat inside one utterance
        // ("eggs, milk, eggs") is caught too.
        seen.add(n);
        fresh.push(value);
    }
    return fresh;
};

const bullets = (items) => (items.length ? items.map((i) => `\n  - ${i}`).join('') : ' none yet');

function systemPrompt(ctx, now) {
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    const dayStr = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Los_Angeles' });

    const itineraryLines = ctx.itineraries.map((i) => {
        const bits = [i.location, i.date].filter(Boolean).join(', ');
        const has = i.items.length ? ` — already has: ${i.items.join('; ')}` : '';
        return `"${i.title}"${bits ? ` (${bits})` : ''} id=${i.id}${has}`;
    });

    return `You route spoken thoughts into a personal dashboard called Me Portal. The speaker is talking to herself, quickly, often mid-thought. Your job is to file it where she would have filed it.

Today is ${dateStr} (${dayStr}), timezone America/Los_Angeles.

# What is already in the portal

This is the current state. Read it before you write anything. Prefer attaching to what exists over creating something new, and never re-add something that is already listed here.

Itineraries (The Daydream):${bullets(itineraryLines)}
Trips (The Atlas):${bullets(ctx.trips.map((t) => `${t.destination}${t.status ? ` — ${t.status}` : ''}`))}
Grocery list, still unbought:${bullets(ctx.groceries)}
Open tasks:${bullets(ctx.todos)}
Treasury (things she wants to buy):${bullets(ctx.treasury.map((t) => `${t.title}${t.category ? ` [${t.category}]` : ''}`))}
Treasury categories in use: ${ctx.treasuryCategories.join(', ') || 'none yet'}
Library:${bullets(ctx.library.map((l) => `${l.title} (${l.type}, ${l.status})`))}
Aspirations:${bullets(ctx.goals)}
Daily rituals:${bullets(ctx.habits)}
Social plans:${bullets(ctx.social)}
Recipes in the Larder:${bullets(ctx.recipes)}
Saved spots — places she already means to go:${bullets(ctx.spots.map((sp) => `${sp.name}${sp.city ? ` (${sp.city})` : ''}${sp.category ? ` — ${sp.category}` : ''}${sp.status === 'been' ? ' [been]' : ''}`))}
Chore rooms in use: ${ctx.rooms.join(', ') || 'none yet'}
In the pantry: ${ctx.pantry.join(', ') || 'nothing yet'}

# The rooms, and what she may call them

This arrives as phone dictation, so words come through mangled. Map near-misses onto the right room rather than taking the transcription literally — "larger", "lauder" and "ladder" all mean **Larder**; "day dream" means the Daydream; "treasure" means the Treasury.

- **Larder** — recipes and the pantry. A recipe ALWAYS belongs here, never the Library.
- **Library** — books, films, TV, albums, games. Things consumed, not cooked.
- **Provisions** — the grocery list.
- **Treasury** — things she wants to buy.
- **Daydream** — day itineraries. **Atlas** — travel to other cities.
- **Register** — plans with other people. **Duty** — chores. **Aspirations** — goals. **Rituals** — daily habits.

# How to file

- Call one or more tools. A single sentence often contains two separate things ("we're out of oat milk and I want to try that ramen place") — file both.
- **Already there?** If she names something that appears above, do not add it again. If everything she said is already filed, call nothing_to_file and say what she already has. Adding it anyway will be rejected before it is written, so you gain nothing by trying.
- **Attach, don't duplicate.** A restaurant in a city where an itinerary already exists belongs on that itinerary — pass its id. Only pass an id that appears in the list above; a made-up id is discarded and a stray new itinerary is created instead.
- Distinguish needing from wanting. Groceries are needs; the Treasury is for wants.
- **Treasury items need a link.** If she gives one, pass it and stop — the page is read for you. If she only describes the thing ("that matte black Hario kettle", "the ribbed tank from Everlane"), use web_search to find it, then pass the URL as the link parameter.
  - Prefer **the brand's own product page** over Amazon, a marketplace, a reseller or a review article. Brand pages have accurate prices, real photography and stable URLs.
  - Search at most once or twice per item. If nothing convincing turns up, file it without a link rather than attaching a page you are unsure about — a wrong product is worse than a missing one.
  - Do not use web_search for anything except finding a Treasury product page.
- **A place she wants to go is a spot, not a todo and not an itinerary.** "I want to try that ramen place", "we should check out the new wine bar", "someone told me about a garden in Berkeley" — all save_spot. The address, neighbourhood, map link and hours are looked up for you, so pass the name as she said it plus any city, and keep her reason verbatim in the why field.
- Use add_to_itinerary only when she is planning an actual day: a date, "for Saturday", or an itinerary that already exists. If she is planning a day around places she has already saved, add them to the itinerary by name.
- Travel to another city or country is a trip, not a spot and not an itinerary.
- Do not invent dates, prices or times she did not say.
- If a thought is genuinely just a note with no home, add it as a todo.
- Keep her words. Tidy grammar, do not rewrite meaning or add flourish.

After the tool calls, reply with one short sentence in plain language describing what you filed, as it will appear in a phone notification. No preamble.`;
}

/* ---------- executors -------------------------------------------------- */

const label = (s, n = 60) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');

/**
 * Executes one tool call. `ctx` carries the duplicate index, `dupes` collects
 * anything refused so it can be reported instead of vanishing.
 *
 * Returns a short outcome clause for the summary, or null when the whole call
 * turned out to be things she already had.
 */
/**
 * Writes a recipe and its ingredients. Ingredients cascade on delete, so a
 * single action row is enough for undo to remove the whole thing.
 */
async function writeRecipe(sb, userId, recipe, actions, toolName) {
    const [row] = (await sb
        .from('recipes')
        .insert([{
            title: recipe.title,
            instructions: recipe.instructions || null,
            tags: recipe.tags && recipe.tags.length ? recipe.tags : ['Imported'],
            image_url: recipe.image_url || null,
            prep_time: recipe.prep_time || null,
            cook_time: recipe.cook_time || null,
            total_time: recipe.total_time || null,
            servings: recipe.servings || null,
            source_url: recipe.source_url || null,
            user_id: userId,
        }])
        .select('id')
        .then(({ data, error }) => {
            if (error) throw new Error(`recipes: ${error.message}`);
            return data || [];
        }));

    actions.push({ tool: toolName, table: 'recipes', id: row.id, label: label(recipe.title) });

    const ingredients = (recipe.ingredients || []).filter((i) => i && i.item);
    if (ingredients.length) {
        const { error } = await sb.from('ingredients').insert(
            ingredients.map((i) => ({
                recipe_id: row.id,
                item: i.item,
                amount: i.amount || null,
                unit: i.unit || null,
                notes: i.notes || null,
                user_id: userId,
            }))
        );
        // The recipe itself is the valuable part. If the ingredient rows fail,
        // keep the recipe and say so rather than losing everything.
        if (error) return { id: row.id, ingredientCount: 0, ingredientError: error.message };
    }
    return { id: row.id, ingredientCount: ingredients.length, ingredientError: null };
}

async function runTool(sb, userId, name, input, actions, ctx, dupes) {
    const push = (table, id, text) => actions.push({ tool: name, table, id, label: label(text) });
    const ins = async (table, rows) => {
        const { data, error } = await sb.from(table).insert(rows).select('id');
        if (error) throw new Error(`${table}: ${error.message}`);
        return data || [];
    };
    // Single-value tools: refuse and report, or return the value to write.
    const once = (key, value, where) => {
        const [fresh] = dedupe(ctx, key, [value], where, dupes);
        return fresh;
    };

    switch (name) {
        case 'add_groceries': {
            const items = dedupe(ctx, 'provisions', input.items, 'on your grocery list', dupes);
            if (!items.length) return null;
            const rows = items.map((text) => ({ text, checked: false, user_id: userId }));
            (await ins('provisions', rows)).forEach((r, i) => push('provisions', r.id, items[i]));
            return `${items.join(', ')} to the grocery list`;
        }
        case 'add_todo': {
            const items = dedupe(ctx, 'todos', input.items, 'on your task list', dupes);
            if (!items.length) return null;
            const rows = items.map((text) => ({ text, completed: false, user_id: userId }));
            (await ins('todos', rows)).forEach((r, i) => push('todos', r.id, items[i]));
            return `${items.length} task${items.length > 1 ? 's' : ''}`;
        }
        case 'add_desire': {
            // The page is the source of truth for name, price and photo; what
            // the model inferred from speech is only a fallback.
            let meta = {};
            let problem = null;
            if (input.link) {
                try {
                    meta = await extractProduct(input.link);
                } catch (err) {
                    problem = err.message;
                }
            }

            // Her words beat a page that could not name the thing.
            const pageNamedIt = meta.title && !meta.title_fallback;
            const title = once('treasury_items', pageNamedIt ? meta.title : (input.title || meta.title), 'in the Treasury');
            if (!title) return null;

            const amount = meta.price_amount ?? null;
            const [r] = await ins('treasury_items', [{
                title,
                category: input.category || 'Other',
                // `price` stays free text because the Treasury form writes to it
                // directly; price_amount is the comparable copy.
                price: amount !== null ? String(amount) : (input.price || null),
                price_amount: amount,
                price_currency: meta.price_currency || null,
                description: meta.description || null,
                brand: meta.brand || null,
                image_url: meta.image_url || null,
                priority: input.priority || 'Low',
                link: meta.link || input.link || null,
                status: 'desired',
                last_checked_at: input.link ? new Date().toISOString() : null,
                user_id: userId,
            }]);
            push('treasury_items', r.id, title);

            // First point on the price chart. Failing here must not cost her
            // the item itself.
            if (amount !== null) {
                await sb.from('treasury_price_history').insert([{
                    item_id: r.id,
                    user_id: userId,
                    price_amount: amount,
                    price_currency: meta.price_currency || null,
                    in_stock: meta.in_stock,
                }]).then(({ error }) => {
                    if (error) console.error('price history insert failed:', error.message);
                });
            }

            if (problem) return `"${title}" to the Treasury, but ${problem} — no price or photo`;
            if (!input.link) return `"${title}" to the Treasury, with no link to read`;
            // Sites behind bot protection serve a challenge page that parses
            // cleanly and contains nothing. Say so rather than implying the
            // shop simply has no price.
            if (!meta.usable) return `"${title}" to the Treasury — the link saved, but ${meta.brand || 'that site'} would not let us read the page`;
            if (amount === null) return `"${title}" to the Treasury — ${meta.brand || 'the page'} did not list a price`;
            return `"${title}" to the Treasury at ${meta.price_currency === 'USD' ? '$' : ''}${amount}`;
        }
        case 'save_spot': {
            // Look the place up first: the resolved name is the one worth
            // deduplicating against, since she may call it "that ramen place"
            // twice and mean the same restaurant.
            const place = await resolvePlace(input.name, { city: input.city });

            if (place.place_id && ctx.index.spotPlaceIds.has(place.place_id)) {
                dupes.push({ item: place.name, where: 'in your spots' });
                return null;
            }

            const spotName = once('spots', place.name, 'in your spots');
            if (!spotName) return null;
            if (place.place_id) ctx.index.spotPlaceIds.add(place.place_id);

            const [r] = await ins('spots', [{
                name: spotName,
                category: input.category || place.category,
                why: input.why || null,
                address: place.address,
                neighborhood: place.neighborhood,
                city: place.city || input.city || null,
                lat: place.lat,
                lng: place.lng,
                maps_url: place.maps_url,
                place_id: place.place_id,
                website: place.website,
                phone: place.phone,
                rating: place.rating,
                price_level: place.price_level,
                hours: place.hours,
                image_url: place.image_url,
                tags: input.tags && input.tags.length ? input.tags : [],
                status: 'want to go',
                source: 'capture',
                user_id: userId,
            }]);
            push('spots', r.id, spotName);
            ctx.spots.push({ name: spotName, city: place.city, category: place.category, status: 'want to go' });

            const where = place.neighborhood || place.city;
            if (place.source === 'unresolved') {
                return `"${spotName}" to your spots — could not find it on a map, so it is just the name for now`;
            }
            return `"${spotName}"${where ? ` in ${where}` : ''} to your spots`;
        }
        case 'add_to_itinerary': {
            let planId = input.plan_id;
            let planTitle = null;

            // Only honour an id we actually handed the model. A hallucinated
            // one would otherwise become an orphaned plan_item pointing at
            // nothing, or fail the foreign key and lose the thought entirely.
            if (planId && !ctx.itineraries.some((p) => String(p.id) === String(planId))) {
                planId = null;
            }

            if (planId) {
                // Same activity, same itinerary — she is repeating herself.
                const seen = ctx.index.planItems[planId] || (ctx.index.planItems[planId] = new Set());
                const n = norm(input.activity);
                if (seen.has(n)) {
                    const plan = ctx.itineraries.find((p) => String(p.id) === String(planId));
                    dupes.push({ item: input.activity, where: `on "${plan ? plan.title : 'that itinerary'}"` });
                    return null;
                }
                seen.add(n);
            } else {
                planTitle = input.new_plan_title || input.activity;
                const [p] = await ins('day_plans', [{
                    title: planTitle,
                    location: input.new_plan_location || input.location || null,
                    planned_date: input.new_plan_date || null,
                    user_id: userId,
                }]);
                planId = p.id;
                push('day_plans', p.id, planTitle);
                // Register it so a second call in the same utterance attaches
                // rather than creating a twin.
                ctx.itineraries.push({
                    id: p.id,
                    title: planTitle,
                    location: input.new_plan_location || input.location || null,
                    date: input.new_plan_date || null,
                    items: [],
                });
                ctx.index.planItems[p.id] = setOf([input.activity]);
            }

            const [item] = await ins('plan_items', [{
                plan_id: planId,
                activity: input.activity,
                location: input.location || null,
                notes: input.notes || null,
                start_time: input.start_time || null,
                is_brainstorm: !input.start_time,
                user_id: userId,
            }]);
            push('plan_items', item.id, input.activity);

            const plan = ctx.itineraries.find((p) => String(p.id) === String(planId));
            return planTitle
                ? `"${input.activity}" to a new itinerary, ${planTitle}`
                : `"${input.activity}" to ${plan ? `"${plan.title}"` : 'an itinerary'}`;
        }
        case 'add_trip': {
            const destination = once('atlas_trips', input.destination, 'in the Atlas');
            if (!destination) return null;
            const [r] = await ins('atlas_trips', [{
                destination,
                status: input.status || 'Dreaming',
                start_date: input.start_date || null,
                notes: input.notes || null,
                user_id: userId,
            }]);
            push('atlas_trips', r.id, destination);
            return `${destination} to the Atlas`;
        }
        case 'add_library_item': {
            const title = once('library_items', input.title, 'in the Library');
            if (!title) return null;
            const [r] = await ins('library_items', [{
                title,
                creator: input.creator || null,
                type: input.type,
                status: input.status || 'Not Started',
                user_id: userId,
            }]);
            push('library_items', r.id, title);
            return `"${title}" to the Library`;
        }
        case 'add_social_plan': {
            const key = `${input.what} with ${input.who}`;
            if (!once('social_plans', key, 'in the Social Register')) return null;
            const [r] = await ins('social_plans', [{
                who: input.who,
                what: input.what,
                when_date: input.when_date || null,
                where_loc: input.where_loc || null,
                user_id: userId,
            }]);
            push('social_plans', r.id, key);
            return key;
        }
        case 'import_recipe': {
            // The URL is the reliable identity; two imports of one page are the
            // most common repeat, and the titles can differ between them.
            if (ctx.index.recipeUrls.has(input.url)) {
                dupes.push({ item: 'that recipe', where: 'in the Larder' });
                return null;
            }

            let recipe;
            try {
                recipe = await extractRecipe(input.url);
            } catch (err) {
                // Never lose the link. A stub she can open and finish beats an
                // error message and nothing saved.
                recipe = {
                    title: 'Recipe to sort out',
                    instructions: '',
                    ingredients: [],
                    source_url: input.url,
                    tags: ['Imported', 'Needs detail'],
                    complete: false,
                    problem: err.message,
                };
            }

            if (!once('recipes', recipe.title, 'in the Larder')) return null;

            if (input.tags && input.tags.length) {
                recipe.tags = [...new Set([...(recipe.tags || []), ...input.tags])];
            }
            ctx.index.recipeUrls.add(input.url);

            const { ingredientCount } = await writeRecipe(sb, userId, recipe, actions, name);
            if (recipe.problem) return `"${recipe.title}" to the Larder — but ${recipe.problem}, so it needs filling in`;
            if (!ingredientCount) return `"${recipe.title}" to the Larder, but no ingredients were listed on the page`;
            return `"${recipe.title}" to the Larder with ${ingredientCount} ingredients`;
        }
        case 'add_recipe': {
            const title = once('recipes', input.title, 'in the Larder');
            if (!title) return null;

            const tags = [...new Set(['Dictated', ...(input.tags || [])])];
            const { ingredientCount } = await writeRecipe(sb, userId, {
                title,
                instructions: input.instructions || '',
                ingredients: (input.ingredients || []).map(parseIngredient),
                servings: input.servings || null,
                tags,
                source_url: null,
            }, actions, name);

            if (!ingredientCount) {
                return `"${title}" to the Larder — no ingredients yet, share the link to fill it in`;
            }
            return `"${title}" to the Larder with ${ingredientCount} ingredients`;
        }
        case 'add_chore': {
            // Chores repeat by nature — the same room needs sweeping weekly —
            // so this one is deliberately not deduplicated.
            const [r] = await ins('chores', [{
                text: input.text, room: input.room, completed: false, user_id: userId,
            }]);
            push('chores', r.id, input.text);
            return `"${input.text}" to ${input.room}`;
        }
        case 'add_goal': {
            const text = once('goals', input.text, 'in your aspirations');
            if (!text) return null;
            const [r] = await ins('goals', [{
                text, horizon: input.horizon, completed: false, user_id: userId,
            }]);
            push('goals', r.id, text);
            return `"${text}" as a ${input.horizon} goal`;
        }
        case 'add_habit': {
            const text = once('habits', input.text, 'in your rituals');
            if (!text) return null;
            const [r] = await ins('habits', [{ text, completed: false, user_id: userId }]);
            push('habits', r.id, text);
            return `"${text}" as a daily ritual`;
        }
        case 'add_pantry_item': {
            const nameIn = once('pantry_ingredients', input.name, 'in the pantry');
            if (!nameIn) return null;
            const [r] = await ins('pantry_ingredients', [{
                name: nameIn.toLowerCase(),
                label: nameIn,
                category: input.category || 'Pantry',
                in_stock: input.in_stock !== false,
                user_id: userId,
            }]);
            push('pantry_ingredients', r.id, nameIn);
            return `${nameIn} to the pantry`;
        }
        default:
            throw new Error(`unknown tool ${name}`);
    }
}

/** "a", "a and b", "a, b and c" */
const listOf = (items) =>
    items.length <= 1
        ? items[0] || ''
        : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** "pasta was already on your grocery list; Rome was already in the Atlas" */
const describeDupes = (dupes) => {
    if (!dupes.length) return null;
    const byWhere = new Map();
    dupes.forEach(({ item, where }) => {
        if (!byWhere.has(where)) byWhere.set(where, []);
        byWhere.get(where).push(item);
    });
    return [...byWhere.entries()]
        .map(([where, items]) => `${listOf(items)} ${items.length > 1 ? 'were' : 'was'} already ${where}`)
        .join('; ');
};

const sentenceCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/* ---------- handler ---------------------------------------------------- */

const REQUIRED = [
    'ANTHROPIC_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'PORTAL_USER_ID',
    'CAPTURE_TOKEN',
];

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    // GET is a health check: which variables the *running* deployment can see.
    // Booleans only — no values, ever. Unauthenticated on purpose, because the
    // thing it most often has to diagnose is the token itself being missing.
    if (req.method === 'GET') {
        const configured = Object.fromEntries(REQUIRED.map((k) => [k, Boolean(process.env[k])]));
        const missing = REQUIRED.filter((k) => !configured[k]);

        // Prove the service client can actually reach the right project.
        // Host only — never the key.
        let dbCheck = { ok: false, error: 'not attempted' };
        let supabaseHost = null;
        try {
            supabaseHost = new URL(process.env.SUPABASE_URL).host;
        } catch {
            supabaseHost = 'SUPABASE_URL is not a valid URL';
        }
        if (!missing.length) {
            // Deliberately not `head: true` — a HEAD request has no response
            // body, so PostgREST's error payload never arrives and every
            // failure renders as an empty message. Ask for a real row, and
            // report the HTTP status, which is the part that actually says
            // whether the key was rejected.
            const probe = async (table) => {
                try {
                    const r = await db().from(table).select('id').limit(1);
                    return r.error
                        ? { ok: false, status: r.status, statusText: r.statusText, error: errText(r.error) }
                        : { ok: true, status: r.status };
                } catch (e) {
                    return { ok: false, error: errText(e) };
                }
            };
            const [cap, prov] = await Promise.all([probe('captures'), probe('provisions')]);
            // Probing two tables separates "this one table is missing" from
            // "the key is being rejected for everything".
            dbCheck = { captures: cap, provisions: prov, ok: cap.ok && prov.ok };
        }

        return res.status(200).json({
            supabaseHost,
            dbCheck,
            ok: missing.length === 0,
            configured,
            missing,
            model: MODEL,
            hint: missing.length
                ? 'Add these in Vercel, then redeploy — env changes only reach the function on a new deployment.'
                : 'Ready. POST with the x-capture-token header.',
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'GET for health, POST to capture' });
    }

    const missing = REQUIRED.filter((k) => !process.env[k]);
    if (missing.length) {
        // Report this before the token check — otherwise a server that is
        // simply missing CAPTURE_TOKEN reports "bad token" and sends you off
        // hunting a mismatch that does not exist.
        return res.status(500).json({
            error: `Not configured: ${missing.join(', ')}. Add them in Vercel and redeploy.`,
        });
    }

    // Two ways in, because the two callers cannot share a secret.
    //
    //   - The iOS Shortcut holds CAPTURE_TOKEN. It is a shared secret in a
    //     place only she can reach, and it maps to PORTAL_USER_ID.
    //   - The web app holds nothing. A token shipped to the browser is not a
    //     token, so it presents the signed-in user's own Supabase session and
    //     the rows are written for whoever that is.
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    let sessionUserId = null;

    if (bearer) {
        const { data: authData, error: authError } = await db().auth.getUser(bearer);
        if (authError || !authData?.user) {
            return res.status(401).json({ error: 'That session has expired — sign in again.' });
        }
        sessionUserId = authData.user.id;
    }

    const auth = sessionUserId ? { ok: true } : compareToken(req.headers['x-capture-token']);
    if (!auth.ok) {
        return res.status(401).json({
            error: 'Bad capture token',
            diagnostic: {
                sentLength: auth.givenLength,
                sentLengthBeforeTrim: auth.givenLengthRaw,
                serverTokenLength: auth.expectedLength,
                sameLength: auth.sameLength,
                hint: auth.givenLength === 0
                    ? 'No token arrived — check the x-capture-token header is actually being sent.'
                    : auth.sameLength
                        ? 'Same length, different value: the two secrets genuinely differ.'
                        : 'Different lengths: likely a truncated paste, or extra characters on one side.',
            },
        });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const text = (body.text || '').toString().trim().slice(0, MAX_TEXT);

    // The share-sheet Shortcut sends a link instead of speech — from NYT
    // Cooking, Serious Eats, anywhere. Recognise it here, whether it arrives as
    // `url` or as text that is nothing but a URL.
    const shared = (body.url || '').toString().trim()
        || (/^https?:\/\/\S+$/i.test(text) ? text : '');

    if (!text && !shared) {
        return res.status(400).json({ error: 'Nothing to file — say something first.' });
    }

    const sb = db();
    // Never trust a user id from the request body — it is taken from the
    // verified session, or from the environment for the Shortcut.
    const userId = sessionUserId || process.env.PORTAL_USER_ID;
    const actions = [];
    // Things she named that were already filed. Collected rather than dropped,
    // because "nothing happened" and "you already have that" look identical
    // from a phone notification and mean very different things.
    const dupes = [];
    let summary = null;
    let narration = null;
    let failure = null;
    const allToolErrors = [];

    // Declared outside the try: the rows are already written by the time a
    // later turn can fail, and the summary has to describe them either way.
    const done = [];
    const toolErrors = [];
    let skipped = null;

    try {
        const ctx = await loadContext(sb, userId);
        const messages = [{ role: 'user', content: text }];
        const system = systemPrompt(ctx, new Date());

        // A shared link needs no interpretation: import it and skip the model
        // entirely. Faster, cheaper, and it cannot pick the wrong room.
        if (shared) {
            try {
                const outcome = await runTool(sb, userId, 'import_recipe', { url: shared }, actions, ctx, dupes);
                if (outcome) done.push(outcome);
            } catch (err) {
                toolErrors.push(`import_recipe: ${errText(err)}`);
            }
        }

        // Three passes: a search may consume one before anything is filed.
        for (let turn = 0; !shared && turn < 3; turn += 1) {
            const r = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: MODEL,
                    max_tokens: 4096,
                    system,
                    tools: [...TOOLS, WEB_SEARCH],
                    messages,
                    // First pass must call something — `nothing_to_file` is the
                    // escape hatch. Without this the model answers in prose and
                    // the endpoint reports success having written nothing.
                    tool_choice: turn === 0 ? { type: 'any' } : { type: 'auto' },
                }),
            });

            if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 300)}`);
            const reply = await r.json();
            messages.push({ role: 'assistant', content: reply.content });

            const calls = reply.content.filter((c) => c.type === 'tool_use');
            // Deliberately NOT used as the summary. Model prose describing
            // work it has not done is worse than no summary at all.
            const said = reply.content.filter((c) => c.type === 'text').map((c) => c.text).join(' ').trim();
            if (said) narration = said;

            // A turn can contain only server-side search — Anthropic runs it
            // and returns the results, but nothing has been filed yet. Breaking
            // here would throw away the search we just paid for.
            const searched = reply.content.some((c) => c.type === 'server_tool_use');
            if (!calls.length) {
                if (searched && turn < 2) {
                    messages.push({ role: 'user', content: 'Now file it with the tools.' });
                    continue;
                }
                break;
            }

            const results = [];
            for (const call of calls) {
                if (call.name === 'nothing_to_file') {
                    skipped = call.input?.because || 'nothing actionable in it.';
                    results.push({ type: 'tool_result', tool_use_id: call.id, content: 'Noted.' });
                    continue;
                }
                try {
                    const before = dupes.length;
                    const outcome = await runTool(sb, userId, call.name, call.input, actions, ctx, dupes);
                    const refused = dupes.slice(before);
                    if (outcome) done.push(outcome);
                    // Tell the model what was refused, so its own narration
                    // does not claim writes the guard blocked.
                    const content = [
                        outcome ? `Filed: ${outcome}` : null,
                        refused.length ? `Already present, not written: ${refused.map((d) => d.item).join(', ')}` : null,
                    ].filter(Boolean).join('. ') || 'Nothing to file.';
                    results.push({ type: 'tool_result', tool_use_id: call.id, content });
                } catch (err) {
                    const why = errText(err);
                    toolErrors.push(`${call.name}: ${why}`);
                    results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: why });
                }
            }
            messages.push({ role: 'user', content: results });
        }

    } catch (err) {
        failure = err.message;
    }

    // Summary is derived from rows that actually landed, never from model prose
    // describing work it may not have done — and it is built out here so that a
    // conversation that died on its last turn still reports what it wrote.
    allToolErrors.push(...toolErrors);
    const dupeText = describeDupes(dupes);
    if (actions.length && dupeText) {
        // Deterministic, not narrated: the model was never told which of its
        // calls the guard rejected until after it had already spoken.
        summary = `Added ${done.join(', and ')}. ${sentenceCase(dupeText)}.`;
    } else if (actions.length) {
        summary = narration || `Added ${done.join(', and ')}.`;
    } else if (dupeText) {
        summary = `Nothing new — ${dupeText}.`;
    } else if (skipped) {
        summary = `Nothing filed — ${skipped}`;
    } else if (failure) {
        summary = 'Saved the transcript, but filing it failed.';
    } else if (toolErrors.length) {
        summary = 'Nothing was filed — every write failed.';
    } else {
        summary = 'Nothing was filed. Say it again with a bit more detail?';
    }

    const { data: logRow, error: logError } = await sb.from('captures').insert([{
        user_id: userId,
        transcript: text || shared,
        summary,
        actions,
        model: MODEL,
        error: failure,
        source: body.source || 'shortcut',
    }]).select('id').single();
    if (logError) {
        // Swallowing this is how a completely silent failure looked like a
        // success. If the log did not land, say so.
        failure = [failure, `capture log failed: ${errText(logError)}`].filter(Boolean).join('; ');
    }

    const wrote = actions.length > 0;
    return res.status(failure && !wrote ? 502 : 200).json({
        summary,
        wrote,
        // The web app needs this to offer undo without refetching the log.
        captureId: logRow?.id || null,
        actions,
        duplicates: dupes.length ? dupes.map((d) => d.item) : undefined,
        error: failure,
        toolErrors: allToolErrors.length ? allToolErrors : undefined,
    });
}

// Named exports for the test harness in scripts/capture-test.mjs. Vercel only
// invokes the default export; these are inert in production.
export { norm, dedupe, describeDupes, loadContext, systemPrompt, TOOLS };
