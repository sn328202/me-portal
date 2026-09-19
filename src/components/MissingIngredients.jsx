import React, { useState, Suspense, lazy } from 'react';

// Behind a click, and a whole emoji dataset: loaded when she opens it, not
// when the Larder does.
const EmojiPicker = lazy(() => import('emoji-picker-react'));
import { Button, Modal } from './ui';
import { guessCategory, iconFor, labelFor } from '../utils/ingredientMatch';
import { readToken, isLight } from '../utils/mapStyle';

/**
 * The last look before a recipe's unknown ingredients become pantry rows.
 *
 * Bulk add used to write straight to the database with a guessed category, and
 * the guess was thin enough that nearly everything landed in `Pantry` — so a
 * pantry carefully split into Produce, Dairy, Protein and Spices got a pile of
 * feta and duck legs dumped into the general drawer, and the only way to find
 * out was to go looking.
 *
 * The guessing is better now, but a guess is still a guess. This shows every
 * row first: rename it, refile it, give it a symbol, or drop it entirely.
 * Nothing is written until the button at the bottom is pressed.
 */
const MissingIngredients = ({ open, lines, categories, onCancel, onConfirm }) => {
    const [rows, setRows] = useState([]);
    const [picking, setPicking] = useState(null);
    const [saving, setSaving] = useState(false);

    /* Seed the rows when the sheet opens, and when what it is being asked
       about actually changes — not on every render of the recipe behind it.
       `lines` is rebuilt by the parent each time it renders, so an effect
       keyed on it threw away every rename, refile and dropped row the moment
       anything else on the page moved: teaching an alias, a pantry update
       landing. The join is the content, which is the thing that decides
       whether to start again. Adjusting state during render rather than in an
       effect is deliberate — an effect paints her edits, then wipes them. */
    const seed = open ? (lines || []).join('\u0000') : null;
    const [seeded, setSeeded] = useState(null);

    if (open && seeded !== seed) {
        setSeeded(seed);
        setRows((lines || []).map((raw, i) => {
            const category = guessCategory(raw);
            return {
                key: `${i}-${raw}`,
                raw,
                label: labelFor(raw),
                category,
                icon: iconFor(category),
            };
        }));
        setPicking(null);
    }

    const update = (key, patch) => setRows((prev) => prev.map((r) => (
        r.key === key
            ? {
                ...r,
                ...patch,
                // Changing the category moves the default symbol with it, but
                // only while the symbol is still a default.
                icon: patch.category && r.icon === iconFor(r.category)
                    ? iconFor(patch.category)
                    : (patch.icon || r.icon),
            }
            : r
    )));

    const drop = (key) => setRows((prev) => prev.filter((r) => r.key !== key));

    const confirm = async () => {
        setSaving(true);
        await onConfirm(rows.map(({ raw, label, category, icon }) => ({ raw, label, category, icon })));
        setSaving(false);
    };

    const emojiTheme = isLight(readToken('--bg-panel', '#ffffff')) ? 'light' : 'dark';

    return (
        <Modal
            open={open}
            onClose={onCancel}
            size="wide"
            title={rows.length === 1
                ? 'Add 1 ingredient to your pantry'
                : `Add ${rows.length} ingredients to your pantry`}
            footer={(
                <>
                    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button variant="solid" disabled={saving || !rows.length} onClick={confirm}>
                        {saving ? 'Adding…' : `Add ${rows.length}`}
                    </Button>
                </>
            )}
        >
            <p className="missing__intro">
                These aren’t in your pantry under any name. Check where each one lands —
                they’ll be added <strong>out of stock</strong>.
            </p>

            <ul className="missing__list">
                {rows.map((row) => (
                    <li key={row.key} className="missing__row">
                        <button
                            type="button"
                            className="missing__icon"
                            aria-label={`Change the symbol for ${row.label}`}
                            onClick={() => setPicking(picking === row.key ? null : row.key)}
                        >
                            {row.icon}
                        </button>

                        {picking === row.key && (
                            <div className="missing__picker">
                                <Suspense fallback={<span className="muted">Loading symbols…</span>}>
                                <EmojiPicker
                                    width={280}
                                    height={320}
                                    theme={emojiTheme}
                                    onEmojiClick={(e) => {
                                        update(row.key, { icon: e.emoji });
                                        setPicking(null);
                                    }}
                                />
                                </Suspense>
                            </div>
                        )}

                        <input
                            type="text"
                            className="missing__name"
                            value={row.label}
                            aria-label="Ingredient name"
                            onChange={(e) => update(row.key, { label: e.target.value })}
                        />

                        <select
                            className="missing__category"
                            value={row.category}
                            aria-label={`Category for ${row.label}`}
                            onChange={(e) => update(row.key, { category: e.target.value })}
                        >
                            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>

                        <button
                            type="button"
                            className="missing__drop"
                            aria-label={`Remove ${row.label} from this list`}
                            onClick={() => drop(row.key)}
                        >
                            ×
                        </button>
                    </li>
                ))}
            </ul>

            {!rows.length && (
                <p className="missing__empty">Nothing left to add — close this when you’re done.</p>
            )}
        </Modal>
    );
};

export default MissingIngredients;
