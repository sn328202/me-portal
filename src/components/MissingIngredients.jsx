import React, { useState, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
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

    // Re-seed whenever the sheet is opened, so a cancelled pass does not leave
    // its edits behind for the next one.
    useEffect(() => {
        if (!open) return;
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
    }, [open, lines]);

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
            size="lg"
            title={`Add ${rows.length} to the pantry`}
            footer={(
                <>
                    <Button onClick={onCancel}>Cancel</Button>
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
                                <EmojiPicker
                                    width={280}
                                    height={320}
                                    theme={emojiTheme}
                                    onEmojiClick={(e) => {
                                        update(row.key, { icon: e.emoji });
                                        setPicking(null);
                                    }}
                                />
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
                            aria-label={`Don’t add ${row.label}`}
                            onClick={() => drop(row.key)}
                        >
                            ×
                        </button>
                    </li>
                ))}
            </ul>

            {!rows.length && (
                <p className="missing__empty">Nothing left to add.</p>
            )}
        </Modal>
    );
};

export default MissingIngredients;
