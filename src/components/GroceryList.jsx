import React, { useMemo, useState } from 'react';
import { GiCheckMark, GiBasket, GiHouse, GiFiles } from 'react-icons/gi';
import { useProvisions } from '../hooks/useProvisions';
import { useIngredients } from '../hooks/useIngredients';
import { plannedFrom, mergeList, byAisle, listAsText } from '../utils/shoppingList';
import { Button, EmptyState } from './ui';

/**
 * What to buy, as one list.
 *
 * It used to be two lists that never spoke: things she typed, and things the
 * meal plan implied, grouped into the same aisles but compared with each
 * other never — so "garlic" written by hand and "4 cloves garlic" from a
 * recipe were two lines in two places on the page. Buying twice is the exact
 * thing a shopping list exists to prevent.
 *
 * And it did not know what was already in the cupboard, which the dashboard's
 * version had learned to. So the page could send her out for pecorino she had
 * bought last week.
 *
 * One list now, keyed the way the pantry matcher keys everything else so it
 * merges on meaning rather than spelling, laid out in the order a shop is
 * walked, with what she already has moved out of the walk and into a line at
 * the bottom.
 *
 * Every row ticks, which is the other half of it — the old planned rows drew
 * a checkbox that was not a control, so half the list could not be checked
 * off while standing in the shop. Ticking says "I have this": on something
 * she typed it crosses it off, on something a recipe wants it marks the
 * ingredient in stock, which is the same sentence said to the right table.
 */

const Row = ({ line, onToggle }) => {
    const got = line.inStock || line.checked;
    const amount = line.amount > 0 ? `${line.amount}${line.unit ? ` ${line.unit}` : ''}` : '';

    return (
        <li className={`shop__row${got ? ' shop__row--got' : ''}`}>
            <button
                type="button"
                className="shop__tick"
                role="checkbox"
                aria-checked={got}
                onClick={() => onToggle(line)}
            >
                <span className="shop__box" aria-hidden="true">{got && <GiCheckMark />}</span>
                <span className="shop__what">
                    {amount && <span className="shop__amount">{amount}</span>}
                    {line.label}
                </span>
            </button>

            {line.inStock && !line.checked && (
                <span className="shop__stocked" title="Already in your pantry">
                    <GiHouse aria-hidden="true" /> in the pantry
                </span>
            )}
            {line.notes.length > 0 && (
                <span className="shop__for">for {line.notes.join(', ')}</span>
            )}
        </li>
    );
};

const GroceryList = ({ plan, recipes, inputRef }) => {
    const { items, addItem, toggleItem, clearChecked } = useProvisions();
    const { matcher, pantryStock, togglePantryStock } = useIngredients();
    const [typed, setTyped] = useState('');
    const [copied, setCopied] = useState(false);

    const lines = useMemo(
        () => mergeList({
            items,
            planned: plannedFrom({ plan, recipes, matcher, pantryStock }),
            matcher,
            pantryStock,
        }),
        [items, plan, recipes, matcher, pantryStock]
    );

    const { aisles, have, needed } = useMemo(() => byAisle(lines), [lines]);

    /* "I have this", said to whichever table is keeping the answer. */
    const toggle = (line) => {
        if (line.itemId) toggleItem(line.itemId);
        else if (line.ingredientId) togglePantryStock(line.ingredientId);
    };

    const add = (e) => {
        e.preventDefault();
        const text = typed.trim();
        if (!text) return;
        addItem(text);
        setTyped('');
    };

    const copy = async () => {
        const text = listAsText({
            items,
            planned: plannedFrom({ plan, recipes, matcher, pantryStock }),
            title: 'SHOPPING',
        });
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // On screen already; not worth a dialog.
        }
    };

    return (
        <div className="shop">
            <div className="shop__head">
                <form onSubmit={add} className="shop__add">
                    <input
                        ref={inputRef}
                        type="text"
                        className="input"
                        value={typed}
                        placeholder="Add something to buy…"
                        aria-label="Add something to buy"
                        onChange={(e) => setTyped(e.target.value)}
                    />
                </form>
                {needed > 0 && (
                    <Button size="sm" variant="ghost" onClick={copy} label="Copy the list">
                        {copied ? <GiCheckMark /> : <GiFiles />} {copied ? 'Copied' : 'Copy'}
                    </Button>
                )}
                {items.some((i) => i.checked) && (
                    <Button size="sm" variant="ghost" onClick={clearChecked} label="Clear bought items">
                        Clear bought
                    </Button>
                )}
            </div>

            {lines.length === 0 ? (
                <EmptyState
                    icon={<GiBasket />}
                    message="Nothing to buy."
                    hint="Type something above, or plan meals in the Hearth and everything they need lands here."
                />
            ) : (
                <>
                    <p className="shop__count">
                        {needed > 0
                            ? <><strong>{needed}</strong> {needed === 1 ? 'thing' : 'things'} to get</>
                            : 'Everything on the list is accounted for.'}
                    </p>

                    {aisles.map((aisle) => (
                        <section key={aisle.name} className="shop__aisle">
                            <h4>{aisle.name}</h4>
                            <ul>
                                {aisle.lines.map((line) => (
                                    <Row key={line.key} line={line} onToggle={toggle} />
                                ))}
                            </ul>
                        </section>
                    ))}

                    {/* Worth seeing once, not worth walking for. */}
                    {have.length > 0 && (
                        <section className="shop__aisle shop__aisle--got">
                            <h4>Already have</h4>
                            <ul>
                                {have.map((line) => (
                                    <Row key={line.key} line={line} onToggle={toggle} />
                                ))}
                            </ul>
                        </section>
                    )}
                </>
            )}
        </div>
    );
};

export default GroceryList;
