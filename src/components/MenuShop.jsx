import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    GiCancel, GiCheckMark, GiBasket, GiFiles, GiScrollUnfurled, GiCycle, GiTrashCan,
} from 'react-icons/gi';
import { useIngredients } from '../hooks/useIngredients';
import { byAisle } from '../utils/shoppingList';
import {
    menuShopping, shopOf, amountText, timesLabel, setMultiplier, swapLine, removeLine,
    undoChange, addExtra, toggleGot, toggleAlso, menuListAsText,
} from '../utils/menuShopping';
import { Button, EmptyState, Modal } from './ui';
import '../styles/MenuShop.css';

/**
 * The shopping list for a menu.
 *
 * Everything a dinner party needs that the weekly list cannot do: make a dish
 * twice over, swap or skip an ingredient for this one evening without touching
 * the recipe, add the things no recipe mentions (roasting pans), shop for a
 * second menu in the same trip, and print the whole thing as a list to hand to
 * someone else.
 *
 * It is all saved on the menu, so the list she builds on Sunday is still there
 * in the shop on Wednesday with her ticks on it.
 */

const STEPS = [0.5, 1, 1.5, 2, 3, 4];

const Stepper = ({ value, onChange, label }) => {
    // A value saved off the steps (2.5, say) moves to the nearest step either side.
    const down = () => onChange([...STEPS].reverse().find((s) => s < value) ?? STEPS[0]);
    const up = () => onChange(STEPS.find((s) => s > value) ?? STEPS.at(-1));
    return (
        <span className="mshop__stepper" role="group" aria-label={label}>
            <button type="button" onClick={down} disabled={value <= STEPS[0]} aria-label={`Make less of ${label}`}>−</button>
            <span className="mshop__times">{timesLabel(value)}</span>
            <button type="button" onClick={up} disabled={value >= STEPS.at(-1)} aria-label={`Make more of ${label}`}>+</button>
        </span>
    );
};

const Row = ({ line, onToggle, onSwap, onRemove, swapping, onSwapDone }) => {
    const got = line.inStock || line.checked;
    const amount = amountText(line);
    const [to, setTo] = useState('');

    return (
        <li className={`shop__row mshop__row${got ? ' shop__row--got' : ''}`}>
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
                <span className="shop__stocked" title="Already in your pantry">in the pantry</span>
            )}
            {line.swappedFrom && <span className="mshop__swapped">instead of {line.swappedFrom}</span>}
            {line.notes.length > 0 && <span className="shop__for">for {line.notes.join(', ')}</span>}

            <span className="mshop__row-actions no-print">
                {!line.extraId && line.origins.length > 0 && (
                    <Button icon size="sm" variant="ghost" label={`Swap ${line.label} for something else`} onClick={() => onSwap(line)}>
                        <GiCycle />
                    </Button>
                )}
                <Button icon size="sm" variant="ghost" label={`Don't buy ${line.label} for this menu`} onClick={() => onRemove(line)}>
                    <GiTrashCan />
                </Button>
            </span>

            {swapping && (
                <form
                    className="mshop__swap no-print"
                    onSubmit={(e) => { e.preventDefault(); onSwapDone(line, to); setTo(''); }}
                >
                    <input
                        className="input"
                        autoFocus
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        placeholder={`Use instead of ${line.label}…`}
                        aria-label={`Use instead of ${line.label}`}
                    />
                    <Button size="sm" variant="solid" type="submit" disabled={!to.trim()}>Swap</Button>
                    <Button size="sm" variant="ghost" onClick={() => onSwapDone(line, '')}>Cancel</Button>
                </form>
            )}
        </li>
    );
};

/**
 * The sheet that prints.
 *
 * Rendered beside the app rather than inside it, so printing is not a fight
 * with the page behind the modal: while this list is open the app itself is
 * hidden from the printer and only this goes on paper. Just the list, no
 * settings or buttons, with a box to tick by hand.
 */
const PrintSheet = ({ title, aisles }) => createPortal(
    <div className="mshop-print" aria-hidden="true">
        <h1>{title}</h1>
        {aisles.map((aisle) => (
            <section key={aisle.name}>
                <h2>{aisle.name}</h2>
                <ul>
                    {aisle.lines.map((line) => {
                        const amount = amountText(line);
                        return (
                            <li key={line.key}>
                                <span className="mshop-print__box" />
                                <span className="mshop-print__what">
                                    {amount && <b>{amount} </b>}{line.label}
                                    {line.swappedFrom && <em> (instead of {line.swappedFrom})</em>}
                                </span>
                                {line.notes.length > 0 && <span className="mshop-print__for">{line.notes.join(', ')}</span>}
                            </li>
                        );
                    })}
                </ul>
            </section>
        ))}
    </div>,
    document.body
);

const MenuShop = ({ menu, menus, recipes, onSaveShop, onClose }) => {
    // While this is open, the printer gets the list and not the app behind it.
    useEffect(() => {
        document.body.classList.add('mshop-printing');
        return () => document.body.classList.remove('mshop-printing');
    }, []);

    const { matcher, pantryStock } = useIngredients();
    const shop = shopOf(menu);
    const [typed, setTyped] = useState('');
    const [swappingKey, setSwappingKey] = useState(null);
    const [copied, setCopied] = useState(false);

    const save = (next) => onSaveShop(menu.id, next);

    // The other menus she is shopping for in this trip, each with its own settings.
    const also = useMemo(
        () => shop.also.map((id) => menus.find((m) => m.id === id)).filter(Boolean),
        [shop.also, menus]
    );
    const together = useMemo(() => [menu, ...also], [menu, also]);

    const { lines, changes } = useMemo(
        () => menuShopping({ menus: together, recipes, matcher, pantryStock }),
        [together, recipes, matcher, pantryStock]
    );
    const { aisles, have, needed } = useMemo(() => byAisle(lines), [lines]);

    // A swap or removal from a line that came from another menu lands on that menu.
    const ownerOf = (line) => {
        const mine = line.origins.find((o) => o.menuId === menu.id);
        return mine ? menu : together.find((m) => line.origins.some((o) => o.menuId === m.id)) || menu;
    };
    const saveTo = (target, next) => onSaveShop(target.id, next);

    const toggle = (line) => save(toggleGot(menu.shop, line.key));
    const remove = (line) => {
        const owner = line.extraId ? menu : ownerOf(line);
        saveTo(owner, removeLine(owner.shop, owner.id, line));
    };
    const finishSwap = (line, to) => {
        setSwappingKey(null);
        if (!to.trim()) return;
        const owner = ownerOf(line);
        saveTo(owner, swapLine(owner.shop, owner.id, line, to));
    };
    const undo = (change) => {
        const owner = together.find((m) => m.id === change.menuId) || menu;
        saveTo(owner, undoChange(owner.shop, change.key));
    };

    const add = (e) => {
        e.preventDefault();
        if (!typed.trim()) return;
        save(addExtra(menu.shop, typed));
        setTyped('');
    };

    const dishes = (m) => (m.user_larder_menu_recipes || [])
        .filter((mr) => mr.recipe_id)
        .map((mr) => recipes.find((r) => r.id === mr.recipe_id))
        .filter(Boolean);

    const others = menus.filter((m) => m.id !== menu.id);
    const title = [menu.title, ...also.map((m) => m.title)].join(' + ');

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(menuListAsText({ title: `${title} shopping list`, aisles }));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    return (
        <Modal open onClose={onClose} size="full" labelledBy="mshop-title">
            <PrintSheet title={`${title} shopping list`} aisles={aisles} />
            <div className="mshop">
                <div className="mshop__bar no-print">
                    <Button variant="ghost" onClick={onClose}><GiCancel /> Back to menus</Button>
                    <span className="mshop__bar-right">
                        {needed > 0 && (
                            <Button variant="ghost" onClick={copy} label="Copy the list">
                                {copied ? <GiCheckMark /> : <GiFiles />} {copied ? 'Copied' : 'Copy'}
                            </Button>
                        )}
                        <Button variant="solid" onClick={() => window.print()} disabled={!lines.length}>
                            <GiScrollUnfurled /> Print list
                        </Button>
                    </span>
                </div>

                <h2 id="mshop-title" className="mshop__title">{title}</h2>

                <div className="mshop__layout">
                    <aside className="mshop__side no-print">
                        <section className="mshop__panel">
                            <h3>How much of each dish</h3>
                            {together.map((m) => (
                                <div key={m.id} className="mshop__menu-dishes">
                                    {together.length > 1 && <p className="mshop__menu-name">{m.title}</p>}
                                    {dishes(m).length === 0 ? (
                                        <p className="muted">No recipes on this menu yet.</p>
                                    ) : dishes(m).map((r) => {
                                        const value = Number(shopOf(m).multipliers[r.id] ?? 1);
                                        return (
                                            <div key={r.id} className="mshop__dish">
                                                <span className="mshop__dish-name">
                                                    {r.title}
                                                    {r.servings && <span className="muted"> · serves {r.servings}</span>}
                                                </span>
                                                <Stepper
                                                    value={value}
                                                    label={r.title}
                                                    onChange={(v) => saveTo(m, setMultiplier(m.shop, r.id, v))}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </section>

                        {others.length > 0 && (
                            <section className="mshop__panel">
                                <h3>Shop for another menu too</h3>
                                <div className="mshop__chips">
                                    {others.map((m) => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            className={`mshop__chip${shop.also.includes(m.id) ? ' mshop__chip--on' : ''}`}
                                            aria-pressed={shop.also.includes(m.id)}
                                            onClick={() => save(toggleAlso(menu.shop, m.id))}
                                        >
                                            {m.title}
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="mshop__panel">
                            <label className="mshop__check">
                                <input
                                    type="checkbox"
                                    checked={shop.pantry}
                                    onChange={(e) => save({ ...shop, pantry: e.target.checked })}
                                />
                                Leave out what's already in my pantry
                            </label>
                        </section>

                        {changes.length > 0 && (
                            <section className="mshop__panel">
                                <h3>Changed for this menu</h3>
                                <ul className="mshop__changes">
                                    {changes.map((c) => (
                                        <li key={`${c.menuId}:${c.key}`}>
                                            <span>
                                                {c.kind === 'swap'
                                                    ? <><s>{c.from}</s> → {c.to}</>
                                                    : <><s>{c.from}</s> not buying</>}
                                                {together.length > 1 && <span className="muted"> · {c.menuTitle}</span>}
                                            </span>
                                            <Button size="sm" variant="ghost" onClick={() => undo(c)}>Undo</Button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </aside>

                    <div className="shop mshop__list">
                        <form onSubmit={add} className="shop__add no-print">
                            <input
                                type="text"
                                className="input"
                                value={typed}
                                placeholder="Add something no recipe asks for, like 4 roasting pans…"
                                aria-label="Add something to buy for this menu"
                                onChange={(e) => setTyped(e.target.value)}
                            />
                        </form>

                        {lines.length === 0 ? (
                            <EmptyState
                                icon={<GiBasket />}
                                message="Nothing to buy yet."
                                hint="Add recipes to this menu and everything they need lands here."
                            />
                        ) : (
                            <>
                                <p className="shop__count no-print">
                                    {needed > 0
                                        ? <><strong>{needed}</strong> {needed === 1 ? 'thing' : 'things'} to get</>
                                        : 'Everything on the list is accounted for.'}
                                </p>

                                {aisles.map((aisle) => (
                                    <section key={aisle.name} className="shop__aisle" data-aisle={aisle.name}>
                                        <h4>
                                            <span className="shop__face" aria-hidden="true">{aisle.face}</span>
                                            {aisle.name}
                                            <span className="shop__tally">{aisle.lines.length}</span>
                                        </h4>
                                        <ul>
                                            {aisle.lines.map((line) => (
                                                <Row
                                                    key={line.key}
                                                    line={line}
                                                    onToggle={toggle}
                                                    onRemove={remove}
                                                    onSwap={(l) => setSwappingKey(l.key)}
                                                    swapping={swappingKey === line.key}
                                                    onSwapDone={finishSwap}
                                                />
                                            ))}
                                        </ul>
                                    </section>
                                ))}

                                {have.length > 0 && (
                                    <section className="shop__aisle shop__aisle--got no-print" data-aisle="Already have">
                                        <h4>
                                            <span className="shop__face" aria-hidden="true">{'✅'}</span>
                                            Already have
                                            <span className="shop__tally">{have.length}</span>
                                        </h4>
                                        <ul>
                                            {have.map((line) => (
                                                <Row
                                                    key={line.key}
                                                    line={line}
                                                    onToggle={toggle}
                                                    onRemove={remove}
                                                    onSwap={(l) => setSwappingKey(l.key)}
                                                    swapping={swappingKey === line.key}
                                                    onSwapDone={finishSwap}
                                                />
                                            ))}
                                        </ul>
                                    </section>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default MenuShop;
