import { createClient } from '@supabase/supabase-js';
import { normaliseSteps, stampPlan, readDate, readClock } from './_cookPlan.js';

/**
 * POST /api/cook-plan   { menu_id, serve_date: "2026-09-26", serve_time: "20:00" }
 * Header: Authorization: Bearer <supabase access token>
 *
 * Reads a menu — every recipe on it, ingredients and method — and works out
 * the order to cook it in so that all of it is ready at once.
 *
 * The thing a menu cannot tell you by looking at it is what has to happen
 * yesterday. Prep and cook times add up to an afternoon; the overnight soak,
 * the two-hour marinade and the dough that has to rest are sentences buried in
 * the middle of a method, and they are the only steps that can actually ruin
 * the dinner, because every other step can be done late and this one cannot be
 * done at all. So the model is given the methods and told to go looking for
 * them.
 *
 * It is asked for minutes before serving and never for a time of day. Working
 * out that 26 hours before Saturday at 8 is Friday at 6pm is arithmetic, and
 * arithmetic belongs in _cookPlan.js where it is tested, not in a model that
 * will occasionally say Saturday.
 *
 * Nothing is written here. The plan comes back, she reads it, and the app
 * saves it if she keeps it.
 */

export const config = { maxDuration: 60 };

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

const MAX_DISHES = 16;
const MAX_METHOD = 6000;        // per recipe
const MAX_INGREDIENTS = 60;     // per recipe

const SYSTEM = `You plan the cooking of a menu so that every dish is ready at the same moment.

You are given the dishes, with their ingredients and their methods, and one serve time. Write the plan as a list of steps. For each step say how many minutes BEFORE SERVING it starts.

Never write a time of day. Never write a date. "starts_before_serve: 1560" is the answer; "Friday at 6pm" is not — the app works out the clock from the number, and it is right every time.

THE POINT OF THIS PLAN
Prep and cook times are the easy part. What ruins a dinner is the step that had to happen yesterday, and those are written in the middle of a method rather than in a time field: soaking, marinating, brining, curing, salting ahead, defrosting, proving or resting dough, chilling or setting a dessert, infusing, souring, making a component the day before. Read every method looking for them. If a method says "soak overnight", that step starts at least 12 hours before it is needed — and it is needed before the cooking starts, not before serving. Work that through.

If a dish has a step like that and you leave it out, the plan is worse than useless, because she will trust it.

HOW TO WRITE IT
- Assume one cook, one oven, one stove, unless the recipes plainly need otherwise. Do not have her in two places at once, and do not put two dishes in the oven at different temperatures at the same time.
- A waiting step must be FINISHED before the step that depends on it starts. If the dal soaks for 12 hours, the step that drains and blitzes it starts at least 12 hours later — not seven. Check every waiting step against the one that follows it: start plus minutes must not land after the next step for that dish.
- Nobody is in the kitchen between 11pm and 6am. If a soak or a rise has to run overnight, start it in the evening and pick it up in the morning; only put a step in the small hours if the food genuinely cannot be made any other way, and say why in the step itself.
- Work backwards from serving. A dish that needs to rest after cooking must finish resting at serve time, not finish cooking at serve time.
- Group sensibly: chopping for three dishes can be one step if it happens at one time. A plan is what to do when, not a retyping of the recipes.
- 8 to 25 steps for a normal menu. Fewer for a simple one. Never more than 40.
- "minutes" is how long that step takes her. "waiting" is true when the time passes without her — soaking, marinating, rising, chilling, roasting unattended — so the plan does not read as an impossible day of solid work.
- Name the dish each step belongs to, exactly as the dish is named in the menu. Use "Everything" for a step that serves the whole meal (laying the table, warming plates).
- Some items on the menu are bought, not cooked. Give them a step only if there is something to do: chill the drinks, take the cake out of the box an hour before, plate the cheese.
- The last steps should be plating and serving.

Write the steps in plain, direct, imperative English, as if leaving instructions for someone competent. Say the thing, not the reason: "Soak the chana in plenty of cold water", not "It is important to soak the chana".

In "note", say in one or two sentences what has to happen well ahead of the day, so she can read that alone and know what she is committing to. If nothing does, say so plainly.`;

const SCHEMA = {
    name: 'cook_plan',
    description: 'The order to cook this menu in so that all of it is ready at serve time.',
    input_schema: {
        type: 'object',
        properties: {
            note: {
                type: 'string',
                description: 'One or two sentences on what must happen before the day itself. If nothing must, say that.',
            },
            steps: {
                type: 'array',
                description: 'Every step, in any order — the app sorts them.',
                items: {
                    type: 'object',
                    properties: {
                        dish: { type: 'string', description: 'The dish this step is for, named exactly as the menu names it, or "Everything".' },
                        what: { type: 'string', description: 'What to do, in the imperative. One step, said in one or two sentences.' },
                        starts_before_serve: { type: 'integer', description: 'Minutes before the serve time that this step starts. An overnight soak before an 8pm dinner is around 1400. Never a time of day.' },
                        minutes: { type: 'integer', description: 'How long this step takes.' },
                        waiting: { type: 'boolean', description: 'True when the time passes without her — soaking, marinating, proving, chilling, unattended roasting.' },
                    },
                    required: ['dish', 'what', 'starts_before_serve', 'minutes'],
                },
            },
        },
        required: ['steps'],
    },
};

const clip = (value, limit) => String(value ?? '').trim().slice(0, limit);

/** The menu, written out the way the model is asked to read it. */
export const dishBrief = (entry) => {
    const recipe = entry.recipes;
    if (!recipe) {
        const note = clip(entry.item_note, 200);
        return `## ${clip(entry.item_name, 120)}  (${clip(entry.course_name, 40) || 'Course'} — bought, not cooked)${note ? `\n${note}` : ''}`;
    }

    const times = [
        recipe.prep_time && `prep ${clip(recipe.prep_time, 40)}`,
        recipe.cook_time && `cook ${clip(recipe.cook_time, 40)}`,
        recipe.total_time && `total ${clip(recipe.total_time, 40)}`,
        recipe.servings && `serves ${clip(recipe.servings, 40)}`,
    ].filter(Boolean).join(' · ');

    const ingredients = (recipe.ingredients || []).slice(0, MAX_INGREDIENTS)
        .map((ing) => `- ${[ing.amount, ing.unit, ing.item].filter(Boolean).join(' ')}${ing.notes ? ` (${clip(ing.notes, 120)})` : ''}`)
        .join('\n');

    return [
        `## ${clip(recipe.title, 120)}  (${clip(entry.course_name, 40) || 'Course'})`,
        times && `Times as written: ${times}`,
        ingredients && `Ingredients:\n${ingredients}`,
        `Method:\n${clip(recipe.instructions, MAX_METHOD) || '(none written down)'}`,
    ].filter(Boolean).join('\n');
};

/** Which recipe a step belongs to, by the name the model gave it back. */
export const matchDish = (name, entries = []) => {
    const want = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!want) return null;
    for (const entry of entries) {
        const title = entry.recipes?.title || entry.item_name || '';
        const have = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (have && (have === want || have.includes(want) || want.includes(have))) {
            return entry.recipe_id || null;
        }
    }
    return null;
};

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') return res.status(405).json({ error: 'Something went wrong sending that. Try again.' });
    if (!process.env.ANTHROPIC_API_KEY) {
        // Never name the variable: this string is rendered on her screen.
        return res.status(500).json({ error: "The cooking schedule isn't set up on the server yet." });
    }
    if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: "The cooking schedule isn't available right now." });
    }

    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!bearer) return res.status(401).json({ error: 'Sign in again to build the schedule.' });

    const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await sb.auth.getUser(bearer);
    if (authError || !auth?.user) {
        return res.status(401).json({ error: 'That session is not valid any more — sign in again.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const serveDate = String(body.serve_date || '').trim();
    const serveTime = String(body.serve_time || '').trim();
    const menuId = String(body.menu_id || '').trim();

    if (!menuId) return res.status(400).json({ error: "Couldn't tell which menu that was — reopen it and try again." });
    if (!readDate(serveDate) || readClock(serveTime) === null) {
        return res.status(400).json({ error: 'Say when you are serving it first.' });
    }

    // Her menu, read as her: the service key is only here to check the token,
    // and the user filter is what keeps it to her own shelf.
    const { data: menu, error: menuError } = await sb
        .from('user_larder_menus')
        .select('id, title, occasion, notes, user_larder_menu_recipes (course_name, order_index, recipe_id, item_name, item_note, recipes (id, title, prep_time, cook_time, total_time, servings, instructions, ingredients (item, amount, unit, notes)))')
        .eq('id', menuId)
        .eq('user_id', auth.user.id)
        .single();

    if (menuError || !menu) return res.status(404).json({ error: 'That menu has been deleted.' });

    const entries = (menu.user_larder_menu_recipes || [])
        .slice()
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .filter((e) => e.recipes || String(e.item_name || '').trim())
        .slice(0, MAX_DISHES);

    if (!entries.some((e) => e.recipes)) {
        return res.status(200).json({
            ok: false,
            error: 'There is nothing to cook on this menu yet — add a recipe and it can plan around it.',
        });
    }

    const brief = [
        `Menu: ${clip(menu.title, 120)}${menu.occasion ? ` — ${clip(menu.occasion, 120)}` : ''}`,
        menu.notes ? `Her note on it: ${clip(menu.notes, 400)}` : '',
        '',
        ...entries.map(dishBrief),
    ].filter(Boolean).join('\n\n');

    try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 8000,
                system: SYSTEM,
                tools: [SCHEMA],
                tool_choice: { type: 'tool', name: 'cook_plan' },
                messages: [{ role: 'user', content: brief }],
            }),
            signal: AbortSignal.timeout(50000),
        });

        if (!r.ok) {
            console.error('cook-plan: Anthropic', r.status, (await r.text()).slice(0, 300));
            return res.status(502).json({ error: "Couldn't build the schedule. Try again in a moment." });
        }

        const reply = await r.json();
        const call = (reply.content || []).find((c) => c.type === 'tool_use');
        const raw = (call?.input?.steps || []).map((step) => ({
            ...step,
            recipe_id: matchDish(step?.dish, entries),
        }));

        const steps = normaliseSteps(raw, { serve_date: serveDate, serve_time: serveTime });
        if (!steps.length) {
            return res.status(200).json({
                ok: false,
                error: "Couldn't work out an order for those dishes. Adding prep and cook times to the recipes usually fixes it.",
            });
        }

        return res.status(200).json({
            ok: true,
            plan: stampPlan({
                serve_date: serveDate,
                serve_time: serveTime,
                steps,
                note: call?.input?.note || '',
            }),
        });
    } catch (err) {
        console.error('cook-plan threw', err?.name, err?.message);
        return res.status(502).json({ error: "Couldn't build the schedule. Try again in a moment." });
    }
}
