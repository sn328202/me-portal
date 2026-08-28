import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/reservation-parse   { text: "<a pasted confirmation email>" }
 * Header: Authorization: Bearer <supabase access token>
 *
 * Reads a Resy / OpenTable / Tock / direct-from-the-restaurant confirmation
 * and returns the fields a reservation is made of.
 *
 * A parser of regexes was the other option and it is the wrong one: every
 * platform writes the date differently, half of them write the time in the
 * subject line, and Tock puts the party size in a sentence. The model reads
 * all of them, and the failure mode is a field left null rather than a
 * confidently wrong date.
 *
 * Nothing is written here. It returns a draft, the form is filled in with it,
 * and she presses save — because a confirmation for the wrong Tuesday that
 * saved itself is worse than no parser.
 */

export const config = { maxDuration: 30 };

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const MAX_TEXT = 12000;

const SCHEMA = {
    name: 'reservation',
    description: 'The booking described by this email.',
    input_schema: {
        type: 'object',
        properties: {
            restaurant: { type: 'string', description: 'The name of the restaurant alone — no branch suffix, no platform name.' },
            date: { type: 'string', description: 'The date of the booking as YYYY-MM-DD. Null if the email does not say.' },
            time: { type: 'string', description: 'The time of the booking as HH:MM on a 24-hour clock.' },
            party_size: { type: 'integer', description: 'How many people.' },
            platform: {
                type: 'string',
                description: 'Which service the booking was made through.',
                enum: ['OpenTable', 'Resy', 'Tock', 'Yelp', 'Google', 'SevenRooms', 'Direct', 'Other'],
            },
            confirmation: { type: 'string', description: 'The confirmation or reservation code, if there is one.' },
            seating: { type: 'string', description: 'Bar, patio, chef’s counter, main dining room — only if stated.' },
            city: { type: 'string' },
            address: { type: 'string' },
            phone: { type: 'string' },
            cancel_by: { type: 'string', description: 'The last moment it can be cancelled free, as an ISO timestamp. Only if the email states a deadline.' },
            cancel_fee: { type: 'string', description: 'What is charged after that, in the words the email uses.' },
            notes: { type: 'string', description: 'Anything else worth keeping — a dress code, a deposit, a note about allergies.' },
        },
        required: ['restaurant'],
    },
};

const SYSTEM = `You read restaurant booking confirmations and report what they say.

Rules:
- Report only what the email states. A field you cannot find is left out, never guessed.
- The year matters. If the email gives a date without a year, use the one that
  makes the booking fall in the future relative to the email's own date.
- The restaurant's name is the restaurant's name, not the subject line and not
  the platform. "Your table at Masque is confirmed" is "Masque".
- Times are local to the restaurant. Do not convert them.
- If the text is not a booking confirmation at all, call the tool with only the
  restaurant field set to an empty string.`;

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') return res.status(405).json({ error: 'POST a confirmation.' });
    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'Not configured: ANTHROPIC_API_KEY.' });
    }
    if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Not configured.' });
    }

    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!bearer) return res.status(401).json({ error: 'Sign in first.' });

    const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await sb.auth.getUser(bearer);
    if (authError || !auth?.user) {
        return res.status(401).json({ error: 'That session is not valid any more — sign in again.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const text = String(body.text || '').trim().slice(0, MAX_TEXT);
    if (text.length < 20) return res.status(400).json({ error: 'Paste the whole confirmation.' });

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
                max_tokens: 1024,
                system: SYSTEM,
                tools: [SCHEMA],
                // It must fill the form in rather than describe the email.
                tool_choice: { type: 'tool', name: 'reservation' },
                messages: [{
                    role: 'user',
                    content: `Today is ${new Date().toISOString().slice(0, 10)}.\n\n${text}`,
                }],
            }),
            signal: AbortSignal.timeout(25000),
        });

        if (!r.ok) {
            console.error('reservation-parse: Anthropic', r.status, (await r.text()).slice(0, 300));
            return res.status(502).json({ error: 'Could not read that one.' });
        }

        const reply = await r.json();
        const call = (reply.content || []).find((c) => c.type === 'tool_use');
        const draft = call?.input || {};

        if (!String(draft.restaurant || '').trim()) {
            return res.status(200).json({ ok: false, error: 'That does not look like a booking confirmation.' });
        }

        return res.status(200).json({ ok: true, draft });
    } catch (err) {
        console.error('reservation-parse threw', err?.name, err?.message);
        return res.status(502).json({ error: 'Could not read that one.' });
    }
}
