import { createClient } from '@supabase/supabase-js';
import { extractProduct } from './_link.js';

/**
 * GET /api/treasury-refresh
 *
 * Re-reads every Treasury item that has a link and records what it costs now.
 * Runs daily from a Vercel cron (see vercel.json).
 *
 * History rows are written only when the price actually moves, so the table is
 * a change log rather than a dense daily series — "it dropped on the 3rd" is
 * the question worth answering, and a row a day per item answers it worse.
 */

/**
 * Sized to fit inside maxDuration rather than to finish in one go: at roughly
 * two seconds an item, eight is comfortable inside sixty. Items are taken
 * longest-unchecked first, so everything comes round within a few days.
 */
export const config = { maxDuration: 60 };

const BATCH = 8;
const GAP_MS = 250;      // between fetches, so we are not hammering a shop

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const authorised = (req) => {
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

    // Vercel attaches this when CRON_SECRET is configured. Preferred.
    if (process.env.CRON_SECRET) return bearer === process.env.CRON_SECRET;

    // Vercel marks its own scheduled invocations with this header.
    if (req.headers['x-vercel-cron']) return true;

    // Manual runs, using the secret that already exists.
    return Boolean(process.env.CAPTURE_TOKEN)
        && (req.headers['x-capture-token'] || '').toString().trim() === process.env.CAPTURE_TOKEN.trim();
};

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (!authorised(req)) return res.status(401).json({ error: 'Not authorised.' });
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.' });
    }

    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    // Longest-unchecked first, so every item comes round eventually even when
    // there are more of them than one batch.
    const { data: items, error } = await sb
        .from('treasury_items')
        .select('id, user_id, title, link, price_amount, price_currency')
        .not('link', 'is', null)
        .neq('status', 'acquired')
        .order('last_checked_at', { ascending: true, nullsFirst: true })
        .limit(BATCH);

    if (error) return res.status(500).json({ error: error.message });

    const checked = [];
    const changes = [];
    const failures = [];

    for (const item of items || []) {
        try {
            const product = await extractProduct(item.link);
            const amount = product.price_amount;
            const before = item.price_amount === null ? null : Number(item.price_amount);
            const moved = amount !== null && amount !== before;

            await sb.from('treasury_items').update({
                last_checked_at: new Date().toISOString(),
                ...(moved
                    ? {
                        price_amount: amount,
                        price: String(amount),
                        price_currency: product.price_currency || item.price_currency,
                    }
                    : {}),
                // Fill gaps left by items saved before the page was readable.
                ...(product.image_url ? { image_url: product.image_url } : {}),
                ...(product.brand ? { brand: product.brand } : {}),
            }).eq('id', item.id);

            if (moved) {
                await sb.from('treasury_price_history').insert([{
                    item_id: item.id,
                    user_id: item.user_id,
                    price_amount: amount,
                    price_currency: product.price_currency || item.price_currency,
                    in_stock: product.in_stock,
                }]);
                changes.push({
                    title: item.title,
                    from: before,
                    to: amount,
                    direction: before === null ? 'first' : amount < before ? 'down' : 'up',
                });
            }
            checked.push(item.title);
        } catch (err) {
            // A shop being down today is not worth failing the run over.
            failures.push({ title: item.title, error: err.message });
            await sb.from('treasury_items')
                .update({ last_checked_at: new Date().toISOString() })
                .eq('id', item.id);
        }
        await sleep(GAP_MS);
    }

    return res.status(200).json({
        checked: checked.length,
        changed: changes.length,
        changes,
        failures: failures.length ? failures : undefined,
    });
}
