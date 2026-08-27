import React, { useState, useMemo } from 'react';
import { guessCategory, iconFor } from '../utils/ingredientMatch';

/**
 * What a recipe card shows in place of its ingredient list.
 *
 * Two thirds of these recipes carry an `image_url` from the page they were
 * imported from, and a photo is what you actually recognise a dish by. The
 * other third were dictated or typed and have no picture at all — so rather
 * than a grey box, they fall back to the ingredients again, but read at a
 * glance instead of as three lines of "1 pcs olive oil".
 *
 * The emojis are the pantry's own. Every ingredient carries a symbol she chose,
 * and the matcher can find the right row for a recipe's wording — so the
 * fallback is built out of her own vocabulary rather than a generic icon set.
 * Anything the pantry has never heard of falls back to its category's symbol,
 * which is still better than a bullet point.
 */

const PREVIEW_COUNT = 6;

const RecipeCover = ({ recipe, matcher }) => {
    const [broken, setBroken] = useState(false);
    const src = (recipe.image_url || '').trim();
    const hasImage = Boolean(src) && !broken;

    const preview = useMemo(() => {
        if (hasImage) return [];
        return (recipe.ingredients || []).slice(0, PREVIEW_COUNT).map((ing, i) => {
            const raw = ing?.item || ing?.name || '';
            const match = matcher ? matcher.matchOne(raw).item : null;
            return {
                key: `${i}-${raw}`,
                // The pantry's own symbol first; a category symbol otherwise.
                icon: match?.icon || iconFor(guessCategory(raw)),
                label: match?.label || match?.name || raw,
                inStock: Boolean(match?.in_stock),
            };
        });
    }, [hasImage, recipe, matcher]);

    if (hasImage) {
        return (
            <div className="recipe-cover">
                <img
                    src={src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    // Decorative: the title sits directly above it, so a screen
                    // reader announcing a filename would only be noise.
                    aria-hidden="true"
                    onError={() => setBroken(true)}
                />
            </div>
        );
    }

    if (!preview.length) return null;

    const rest = (recipe.ingredients || []).length - preview.length;

    return (
        <ul className="recipe-glance">
            {preview.map((ing) => (
                <li
                    key={ing.key}
                    className={`recipe-glance__item${ing.inStock ? ' is-stocked' : ''}`}
                    title={ing.inStock ? `${ing.label} — in stock` : ing.label}
                >
                    <span className="recipe-glance__icon" aria-hidden="true">{ing.icon}</span>
                    <span className="recipe-glance__name">{ing.label}</span>
                </li>
            ))}
            {rest > 0 && <li className="recipe-glance__more">+{rest}</li>}
        </ul>
    );
};

export default RecipeCover;
