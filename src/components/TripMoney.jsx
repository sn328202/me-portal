import React, { useMemo, useState } from 'react';
import { Button, Modal } from './ui';
import { useTripMoney } from '../hooks/useTripMoney';
import { formatMoney } from '../utils/tripCosts';
import { rateFor, equalAmong, sharesOf, paidGap, owedGap, BASE } from '../utils/money';
import '../styles/TripMoney.css';

const usd = (n) => formatMoney(n, BASE);
const round2 = (n) => Math.round(Number(n) * 100) / 100;

/** Who's going: names as chips, add and remove. */
const Travelers = ({ names, onChange }) => {
    const [draft, setDraft] = useState('');
    const add = (e) => {
        e.preventDefault();
        const name = draft.trim();
        if (!name || names.includes(name)) return;
        onChange([...names, name]);
        setDraft('');
    };
    return (
        <div className="money__travelers">
            {names.map((n) => (
                <span key={n} className="money__chip">
                    {n}
                    <button type="button" aria-label={`Remove ${n}`} onClick={() => onChange(names.filter((x) => x !== n))}>×</button>
                </span>
            ))}
            <form onSubmit={add} className="money__add">
                <input
                    className="input"
                    value={draft}
                    placeholder={names.length ? 'Add someone' : 'Who’s going? Add a name'}
                    aria-label="Add a traveler"
                    onChange={(e) => setDraft(e.target.value)}
                />
            </form>
        </div>
    );
};

/** Edit one cost: amount, currency, USD, who paid, whose share. */
const CostEditor = ({ cost, travelers, onSaveCost, onSaveSplit, fetchRate, onDone }) => {
    const [amount, setAmount] = useState(cost.amount ?? '');
    const [currency, setCurrency] = useState(cost.currency);
    const [rate, setRate] = useState(cost.currency === BASE ? 1 : (Number(cost.row.fx_rate) || ''));
    const [manual, setManual] = useState(Boolean(cost.row.fx_manual));
    const [rateMsg, setRateMsg] = useState(null);
    const foreign = currency.trim().toUpperCase() !== BASE;
    const usdValue = foreign ? (Number(amount) > 0 && Number(rate) > 0 ? round2(Number(amount) * Number(rate)) : '') : (amount === '' ? '' : Number(amount));
    const [usdDraft, setUsdDraft] = useState(null);

    const people = travelers.length ? travelers : [];
    const startPaid = Object.fromEntries(people.map((n) => [n, '']));
    for (const p of cost.split?.paid || []) startPaid[p.name] = String(p.usd);
    const [paid, setPaid] = useState(startPaid);

    const custom = Array.isArray(cost.split?.owed) && cost.split.owed.length > 0;
    const [mode, setMode] = useState(custom ? 'custom' : 'equal');
    const [among, setAmong] = useState(custom ? cost.split.owed.map((o) => o.name) : people);
    const startOwed = Object.fromEntries(people.map((n) => [n, '']));
    for (const o of cost.split?.owed || []) startOwed[o.name] = String(o.usd);
    const [owed, setOwed] = useState(startOwed);
    const [saving, setSaving] = useState(false);

    const total = Number(usdDraft ?? usdValue) || 0;
    const paidList = Object.entries(paid).filter(([, v]) => Number(v) > 0).map(([name, v]) => ({ name, usd: round2(v) }));
    const owedList = mode === 'custom'
        ? Object.entries(owed).filter(([, v]) => Number(v) > 0).map(([name, v]) => ({ name, usd: round2(v) }))
        : (among.length === people.length ? null : equalAmong(total, among));
    const pGap = paidList.length ? paidGap(total, paidList) : 0;
    const oGap = mode === 'custom' ? owedGap(total, owedList || []) : 0;
    const preview = sharesOf(total, owedList, people);

    const lookUp = async () => {
        setRateMsg('Looking up…');
        try {
            const r = await fetchRate(currency.trim().toUpperCase(), cost.date);
            setRate(r.rate); setManual(false); setUsdDraft(null);
            setRateMsg(`1 ${currency.toUpperCase()} = ${r.rate.toFixed(4)} USD (${r.source}, ${r.date})`);
        } catch (err) {
            setRateMsg(err.message);
        }
    };

    const save = async () => {
        setSaving(true);
        try {
            const cur = currency.trim().toUpperCase() || BASE;
            const amt = amount === '' ? null : Number(amount);
            let fx = cur === BASE ? null : (Number(rate) || null);
            let isManual = cur === BASE ? false : manual;
            if (usdDraft !== null && amt > 0) {
                if (cur === BASE) { /* a USD cost: the USD box is the amount */ }
                else { fx = rateFor(amt, usdDraft); isManual = true; }
            }
            const finalAmount = cur === BASE && usdDraft !== null ? Number(usdDraft) : amt;
            await onSaveCost(cost, { cost: finalAmount, currency: cur === BASE ? null : cur, fx_rate: fx, fx_manual: isManual });
            await onSaveSplit(cost, { paid: paidList, owed: owedList });
            onDone();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="money__editor">
            <h4>{cost.title} <span>{cost.when}</span></h4>

            <div className="money__grid">
                <label className="field"><span className="field__label">Amount charged</span>
                    <input className="input" type="number" step="0.01" min="0" value={amount}
                        onChange={(e) => { setAmount(e.target.value); setUsdDraft(null); }} />
                </label>
                <label className="field"><span className="field__label">Currency</span>
                    <input className="input" value={currency} maxLength={3}
                        onChange={(e) => { setCurrency(e.target.value.toUpperCase()); setUsdDraft(null); setRateMsg(null); }} />
                </label>
                {foreign && (
                    <label className="field"><span className="field__label">USD per {currency || '—'}</span>
                        <input className="input" type="number" step="0.000001" min="0" value={rate}
                            onChange={(e) => { setRate(e.target.value); setManual(true); setUsdDraft(null); }} />
                    </label>
                )}
                <label className="field"><span className="field__label">In USD</span>
                    <input className="input" type="number" step="0.01" min="0"
                        value={usdDraft ?? usdValue}
                        onChange={(e) => setUsdDraft(e.target.value)} />
                </label>
            </div>
            {foreign && (
                <p className="money__hint">
                    <Button size="sm" type="button" onClick={lookUp}>Look up the rate</Button>{' '}
                    {rateMsg || (manual ? 'Rate set by hand.' : 'Rate looked up for the booking’s date. Type the USD from your card statement to override it.')}
                </p>
            )}

            <h5>Who paid</h5>
            {people.length === 0 ? <p className="money__hint">Add who’s going first.</p> : (
                <div className="money__people">
                    {people.map((n) => (
                        <label key={n} className="money__person">
                            <span>{n}</span>
                            <input className="input" type="number" step="0.01" min="0" placeholder="0" value={paid[n] ?? ''}
                                onChange={(e) => setPaid({ ...paid, [n]: e.target.value })} />
                            <Button size="sm" type="button" onClick={() => setPaid({ ...Object.fromEntries(people.map((x) => [x, ''])), [n]: String(total) })}>
                                Paid it all
                            </Button>
                        </label>
                    ))}
                    {paidList.length > 0 && Math.abs(pGap) >= 0.01 && (
                        <p className="money__warn">{pGap > 0 ? `${usd(pGap)} not accounted for yet.` : `That’s ${usd(-pGap)} more than the cost.`}</p>
                    )}
                </div>
            )}

            <h5>Whose share</h5>
            {people.length > 0 && (
                <>
                    <div className="money__mode" role="radiogroup" aria-label="How it is split">
                        <label><input type="radio" checked={mode === 'equal'} onChange={() => setMode('equal')} /> Split equally</label>
                        <label><input type="radio" checked={mode === 'custom'} onChange={() => setMode('custom')} /> Custom amounts</label>
                    </div>
                    <div className="money__people">
                        {people.map((n) => (
                            <label key={n} className="money__person">
                                {mode === 'equal' ? (
                                    <>
                                        <span>
                                            <input type="checkbox" checked={among.includes(n)}
                                                onChange={() => setAmong(among.includes(n) ? among.filter((x) => x !== n) : [...among, n])} />
                                            {' '}{n}
                                        </span>
                                        <em>{usd((preview[n] || 0) / 100)}</em>
                                    </>
                                ) : (
                                    <>
                                        <span>{n}</span>
                                        <input className="input" type="number" step="0.01" min="0" placeholder="0" value={owed[n] ?? ''}
                                            onChange={(e) => setOwed({ ...owed, [n]: e.target.value })} />
                                    </>
                                )}
                            </label>
                        ))}
                        {mode === 'custom' && Math.abs(oGap) >= 0.01 && (
                            <p className="money__warn">{oGap > 0 ? `${usd(oGap)} of the cost is not anyone’s share yet.` : `Shares are ${usd(-oGap)} more than the cost.`}</p>
                        )}
                    </div>
                </>
            )}

            <div className="money__acts">
                <Button type="button" onClick={onDone}>Cancel</Button>
                <Button type="button" variant="solid" disabled={saving || (mode === 'equal' && people.length > 0 && !among.length)} onClick={save}>
                    {saving ? 'Saving…' : 'Save'}
                </Button>
            </div>
        </div>
    );
};

const paidLine = (split) => {
    const paid = (split?.paid || []).filter((p) => Number(p.usd) > 0);
    if (!paid.length) return null;
    return paid.map((p) => `${p.name} ${usd(p.usd)}`).join(', ');
};

/**
 * Who paid what on this trip. Sits as a tab beside the trip's totals: who's
 * going, each person's paid / share / balance, and who owes whom. "Every
 * cost" opens the full list, where each cost's amount, currency, USD value,
 * payers and shares can be edited.
 */
const TripMoney = ({ trip, planner, onTravelers }) => {
    const money = useTripMoney(trip, planner);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const { summary, travelers, costs } = money;
    const editingCost = useMemo(() => costs.find((c) => c.key === editing) || null, [costs, editing]);

    return (
        <div className="money">
            <Travelers names={travelers} onChange={onTravelers} />

            {summary.people.length > 0 && (
                <table className="money__balances">
                    <thead><tr><th>Who</th><th>Paid</th><th>Share</th><th>Balance</th></tr></thead>
                    <tbody>
                        {summary.people.map((p) => (
                            <tr key={p.name}>
                                <td>{p.name}</td>
                                <td>{usd(p.paid)}</td>
                                <td>{usd(p.share)}</td>
                                <td className={p.net > 0.005 ? 'is-owed' : p.net < -0.005 ? 'is-owing' : ''}>
                                    {p.net > 0.005 ? `gets ${usd(p.net)}` : p.net < -0.005 ? `owes ${usd(-p.net)}` : 'even'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {summary.settle.length > 0 && (
                <ul className="money__settle">
                    {summary.settle.map((s) => <li key={`${s.from}-${s.to}`}>{s.from} pays {s.to} <strong>{usd(s.usd)}</strong></li>)}
                </ul>
            )}

            {summary.unpaidCount > 0 && (
                <p className="money__warn">{usd(summary.unpaid)} across {summary.unpaidCount} {summary.unpaidCount === 1 ? 'cost has' : 'costs have'} no payer yet.</p>
            )}
            {summary.unrated > 0 && <p className="money__warn">{summary.unrated} still need a USD amount.</p>}
            {money.rateNote && <p className="money__warn">{money.rateNote}</p>}

            <Button size="sm" onClick={() => setOpen(true)}>Every cost ({costs.length})</Button>

            <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editingCost ? 'Edit cost' : 'Every cost'} size="wide">
                <div className="money__modal">
                    {editingCost ? (
                        <CostEditor
                            key={editingCost.key}
                            cost={editingCost}
                            travelers={travelers}
                            onSaveCost={money.saveCost}
                            onSaveSplit={money.saveSplit}
                            fetchRate={money.fetchRate}
                            onDone={() => setEditing(null)}
                        />
                    ) : costs.length === 0 ? (
                        <p className="money__hint">Nothing on this trip has a price yet.</p>
                    ) : (
                        <ul className="money__costs">
                            {costs.map((c) => (
                                <li key={c.key}>
                                    <button type="button" className="money__cost" onClick={() => setEditing(c.key)}>
                                        <span className="money__when">{c.when}</span>
                                        <span className="money__what">
                                            <strong>{c.title}</strong>
                                            <span>{paidLine(c.split) ? `Paid by ${paidLine(c.split)}` : 'Who paid? Not recorded'}</span>
                                        </span>
                                        <span className="money__amt">
                                            {c.amount === null ? <em>No amount</em> : (
                                                <>
                                                    <strong>{c.usd === null ? '—' : usd(c.usd)}</strong>
                                                    {c.currency !== BASE && <span>{formatMoney(c.amount, c.currency)}</span>}
                                                    {c.needsRate && <span className="money__flag">needs a rate</span>}
                                                </>
                                            )}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default TripMoney;
