import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

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

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const MAX_TEXT = 4000;

const db = () =>
    createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

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
            'Add something she wants to buy to the Treasury (a desire ledger, not a shopping list). Use for objects, clothes, furniture, jewellery — things wanted rather than needed.',
        input_schema: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                category: { type: 'string', description: 'e.g. Home, Kitchen, Closet. Reuse an existing category when one fits.' },
                price: { type: 'string', description: 'Number only, no currency symbol. Omit if unknown.' },
                priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
                link: { type: 'string' },
            },
            required: ['title'],
        },
    },
    {
        name: 'add_to_itinerary',
        description:
            'Add a place or activity to a day itinerary (The Daydream). Use for restaurants, exhibitions, shops, anything she wants to go to. Attach to an existing itinerary when the location or theme matches one; otherwise create a new one. Items with no fixed time go in as brainstorm entries.',
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
        description: 'Add something to read, watch, listen to or play to The Library.',
        input_schema: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                creator: { type: 'string' },
                type: { type: 'string', enum: ['books', 'movies', 'tv shows', 'albums', 'games', 'items'] },
                status: { type: 'string', enum: ['wishlist', 'consuming', 'finished'] },
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

async function loadContext(sb, userId) {
    const q = (table, cols, order) =>
        sb.from(table).select(cols).eq('user_id', userId).order(order, { ascending: false }).limit(25);

    const [plans, trips, treasury, chores, pantry] = await Promise.all([
        q('day_plans', 'id, title, location, planned_date', 'created_at'),
        q('atlas_trips', 'destination, status', 'created_at'),
        q('treasury_items', 'category', 'created_at'),
        q('chores', 'room', 'created_at'),
        q('pantry_ingredients', 'name', 'created_at'),
    ]);

    const uniq = (rows, key) => [...new Set((rows.data || []).map((r) => r[key]).filter(Boolean))];

    return {
        itineraries: (plans.data || []).map((p) => ({
            id: p.id,
            title: p.title,
            location: p.location,
            date: p.planned_date,
        })),
        trips: uniq(trips, 'destination'),
        treasuryCategories: uniq(treasury, 'category'),
        rooms: uniq(chores, 'room'),
        pantry: uniq(pantry, 'name').slice(0, 60),
    };
}

function systemPrompt(ctx, now) {
    return `You route spoken thoughts into a personal dashboard called Me Portal. The speaker is talking to herself, quickly, often mid-thought. Your job is to file it where she would have filed it.

Today is ${now.toISOString().slice(0, 10)} (${now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Los_Angeles' })}), timezone America/Los_Angeles.

What already exists — prefer attaching to these over creating duplicates:
- Itineraries: ${ctx.itineraries.length ? ctx.itineraries.map((i) => `"${i.title}"${i.location ? ` (${i.location})` : ''} id=${i.id}`).join('; ') : 'none yet'}
- Trips: ${ctx.trips.join(', ') || 'none yet'}
- Treasury categories: ${ctx.treasuryCategories.join(', ') || 'none yet'}
- Chore rooms: ${ctx.rooms.join(', ') || 'none yet'}
- In the pantry: ${ctx.pantry.join(', ') || 'nothing yet'}

Rules:
- Call one or more tools. A single sentence often contains two things ("we're out of oat milk and I want to try that ramen place") — file both.
- Distinguish needing from wanting. Groceries are needs; the Treasury is for wants.
- A restaurant, exhibition, shop or activity she wants to visit is an itinerary item, not a todo. If an existing itinerary matches by city or theme, add to it; otherwise create one with a title she would recognise.
- A day out is an itinerary. Travel to another city or country is a trip.
- Do not invent dates, prices or times she did not say.
- If a thought is genuinely just a note with no home, add it as a todo.
- Keep her words. Tidy grammar, do not rewrite meaning or add flourish.

After the tool calls, reply with one short sentence in plain language describing what you filed, as it will appear in a phone notification. No preamble.`;
}

/* ---------- executors -------------------------------------------------- */

const label = (s, n = 60) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');

async function runTool(sb, userId, name, input, actions) {
    const push = (table, id, text) => actions.push({ tool: name, table, id, label: label(text) });
    const ins = async (table, rows) => {
        const { data, error } = await sb.from(table).insert(rows).select('id');
        if (error) throw new Error(`${table}: ${error.message}`);
        return data || [];
    };

    switch (name) {
        case 'add_groceries': {
            const rows = input.items.map((text) => ({ text, checked: false, user_id: userId }));
            (await ins('provisions', rows)).forEach((r, i) => push('provisions', r.id, input.items[i]));
            return `${input.items.length} to the grocery list`;
        }
        case 'add_todo': {
            const rows = input.items.map((text) => ({ text, completed: false, user_id: userId }));
            (await ins('todos', rows)).forEach((r, i) => push('todos', r.id, input.items[i]));
            return `${input.items.length} task${input.items.length > 1 ? 's' : ''}`;
        }
        case 'add_desire': {
            const [r] = await ins('treasury_items', [{
                title: input.title,
                category: input.category || 'Uncategorised',
                price: input.price || null,
                priority: input.priority || 'Low',
                link: input.link || null,
                status: 'desired',
                user_id: userId,
            }]);
            push('treasury_items', r.id, input.title);
            return `"${input.title}" to the Treasury`;
        }
        case 'add_to_itinerary': {
            let planId = input.plan_id;
            let planTitle = null;
            if (!planId) {
                const [p] = await ins('day_plans', [{
                    title: input.new_plan_title || input.activity,
                    location: input.new_plan_location || input.location || null,
                    planned_date: input.new_plan_date || null,
                    user_id: userId,
                }]);
                planId = p.id;
                planTitle = input.new_plan_title || input.activity;
                push('day_plans', p.id, planTitle);
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
            return planTitle
                ? `"${input.activity}" to a new itinerary, ${planTitle}`
                : `"${input.activity}" to an itinerary`;
        }
        case 'add_trip': {
            const [r] = await ins('atlas_trips', [{
                destination: input.destination,
                status: input.status || 'Dreaming',
                start_date: input.start_date || null,
                notes: input.notes || null,
                user_id: userId,
            }]);
            push('atlas_trips', r.id, input.destination);
            return `${input.destination} to the Atlas`;
        }
        case 'add_library_item': {
            const [r] = await ins('library_items', [{
                title: input.title,
                creator: input.creator || null,
                type: input.type,
                status: input.status || 'wishlist',
                user_id: userId,
            }]);
            push('library_items', r.id, input.title);
            return `"${input.title}" to the Library`;
        }
        case 'add_social_plan': {
            const [r] = await ins('social_plans', [{
                who: input.who,
                what: input.what,
                when_date: input.when_date || null,
                where_loc: input.where_loc || null,
                user_id: userId,
            }]);
            push('social_plans', r.id, `${input.what} with ${input.who}`);
            return `${input.what} with ${input.who}`;
        }
        case 'add_chore': {
            const [r] = await ins('chores', [{
                text: input.text, room: input.room, completed: false, user_id: userId,
            }]);
            push('chores', r.id, input.text);
            return `"${input.text}" to ${input.room}`;
        }
        case 'add_goal': {
            const [r] = await ins('goals', [{
                text: input.text, horizon: input.horizon, completed: false, user_id: userId,
            }]);
            push('goals', r.id, input.text);
            return `"${input.text}" as a ${input.horizon} goal`;
        }
        case 'add_habit': {
            const [r] = await ins('habits', [{ text: input.text, completed: false, user_id: userId }]);
            push('habits', r.id, input.text);
            return `"${input.text}" as a daily ritual`;
        }
        case 'add_pantry_item': {
            const [r] = await ins('pantry_ingredients', [{
                name: input.name.toLowerCase(),
                label: input.name,
                category: input.category || 'Pantry',
                in_stock: input.in_stock !== false,
                user_id: userId,
            }]);
            push('pantry_ingredients', r.id, input.name);
            return `${input.name} to the pantry`;
        }
        default:
            throw new Error(`unknown tool ${name}`);
    }
}

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
        return res.status(200).json({
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

    const auth = compareToken(req.headers['x-capture-token']);
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
    if (!text) return res.status(400).json({ error: 'Nothing to file — say something first.' });

    const sb = db();
    const userId = process.env.PORTAL_USER_ID;
    const actions = [];
    let summary = null;
    let narration = null;
    let failure = null;

    try {
        const ctx = await loadContext(sb, userId);
        const messages = [{ role: 'user', content: text }];
        const system = systemPrompt(ctx, new Date());
        const done = [];
        let skipped = null;

        // Two passes is enough: one to call tools, one to summarise.
        for (let turn = 0; turn < 2; turn += 1) {
            const r = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: MODEL,
                    max_tokens: 1024,
                    system,
                    tools: TOOLS,
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

            if (!calls.length) break;

            const results = [];
            for (const call of calls) {
                if (call.name === 'nothing_to_file') {
                    skipped = call.input?.because || 'nothing actionable in it.';
                    results.push({ type: 'tool_result', tool_use_id: call.id, content: 'Noted.' });
                    continue;
                }
                try {
                    const outcome = await runTool(sb, userId, call.name, call.input, actions);
                    done.push(outcome);
                    results.push({ type: 'tool_result', tool_use_id: call.id, content: `Filed: ${outcome}` });
                } catch (err) {
                    results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: err.message });
                }
            }
            messages.push({ role: 'user', content: results });
        }

        // Summary is derived from rows that actually landed. `narration` is
        // only allowed to speak when there is something to speak about.
        if (actions.length) {
            summary = narration || `Added ${done.join(', and ')}.`;
        } else if (skipped) {
            summary = `Nothing filed — ${skipped}`;
        } else {
            summary = 'Nothing was filed. Say it again with a bit more detail?';
        }
    } catch (err) {
        failure = err.message;
        summary = 'Saved the transcript, but filing it failed.';
    }

    const { error: logError } = await sb.from('captures').insert([{
        user_id: userId,
        transcript: text,
        summary,
        actions,
        model: MODEL,
        error: failure,
        source: body.source || 'shortcut',
    }]);
    if (logError) {
        // Swallowing this is how a completely silent failure looked like a
        // success. If the log did not land, say so.
        failure = [failure, `capture log failed: ${logError.message}`].filter(Boolean).join('; ');
    }

    const wrote = actions.length > 0;
    return res.status(failure && !wrote ? 502 : 200).json({
        summary,
        wrote,
        actions,
        error: failure,
    });
}
