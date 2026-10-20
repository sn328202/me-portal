import React, { useMemo, useState } from 'react';
import { Button, Modal, Tabs } from './ui';
import { formatMoney } from '../utils/tripCosts';
import {
    rateFor, equalAmong, sharesOf, paidGap, owedGap, BASE, BUCKETS, responsibleFor, statementText,
} from '../utils/money';
import '../styles/TripMoney.css';

/** Exact, for the cost editor. */
const usd = (n) => formatMoney(n, BASE);
/** Whole dollars, for summaries — cents across eight people is noise. */
const usd0 = (n) => formatMoney(Math.round(Number(n) || 0), BASE);
const round2 = (n) => Math.round(Number(n) * 100) / 100;
const ALL = '__everything__';

const bucketLabel = (id) => BUCKETS.find((b) => b.id === id)?.label || id;
const bucketWords = (buckets = []) => (buckets.includes('all')
    ? 'everything'
    : buckets.map((b) => bucketLabel(b).toLowerCase()).join(' and '));

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



/** "$1,055.00" — exact, so a breakdown adds up to the cent. */
const exact = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: BASE, minimumFractionDigits: 2 }).format(Number(n) || 0);

/**
 * One transfer, with what it is for right on the card: each cost the payer is
 * being charged for (their own share and anyone they cover), less what they
 * already paid. "See the full breakdown" opens the per-person detail.
 */
const Transfer = ({ t, st, onWhy }) => {
    const splitAcross = st && Math.abs(-st.net - t.usd) > 0.005;
    return (
        <li className="money__transfer">
            <div className="money__transfer-top">
                <span className="money__who-pays"><b>{t.from}</b> pays <b>{t.to}</b></span>
                <strong>{usd0(t.usd)}</strong>
            </div>
            {st && (
                <ul className="money__for">
                    {st.charges.map((c) => (
                        <li key={c.key}>
                            <span>
                                {c.title}
                                {(c.people.length > 1 || c.people[0]?.name !== st.name) && (
                                    <em> · {c.people.map((p) => p.name).join(', ')}</em>
                                )}
                            </span>
                            <span>{exact(c.usd)}</span>
                        </li>
                    ))}
                    {st.payments.map((p) => (
                        <li key={p.key} className={p.usd < 0 ? 'money__for-got' : 'money__for-paid'}>
                            <span>{p.usd < 0 ? p.title : `Paid: ${p.title}`}</span>
                            <span>{p.usd < 0 ? `+${exact(-p.usd)}` : `−${exact(p.usd)}`}</span>
                        </li>
                    ))}
                    <li className="money__for-total">
                        <span>{splitAcross ? `Owes ${exact(-st.net)} in all; this part to ${t.to}` : 'Owes'}</span>
                        <span>{exact(splitAcross ? t.usd : -st.net)}</span>
                    </li>
                </ul>
            )}
            {st && <button type="button" className="money__link" onClick={() => onWhy(t.from)}>See the full breakdown and copy it →</button>}
        </li>
    );
};

/**
 * One person's statement: each cost they are charged for (their own share and
 * anyone they cover), what they already paid, and what that leaves. Built to
 * be sent — "Copy" puts the same thing in the clipboard as plain text.
 */
const Breakdown = ({ s, transfers, tripName, open }) => {
    const [copied, setCopied] = useState(false);
    const out = transfers.filter((t) => t.from === s.name);
    const back = transfers.filter((t) => t.to === s.name);
    const copy = async () => {
        const text = statementText(s, transfers, tripName, exact);
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            window.prompt('Copy this:', text);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    const headline = s.net < -0.005 ? `owes ${exact(-s.net)}` : s.net > 0.005 ? `gets back ${exact(s.net)}` : 'all square';

    return (
        <details className="money__statement" id={`statement-${s.name}`} open={open || undefined}>
            <summary>
                <span className="money__st-name">{s.name}</span>
                <span className={`money__net${s.net > 0.005 ? ' is-owed' : s.net < -0.005 ? ' is-owing' : ''}`}>{headline}</span>
            </summary>

            <table className="money__st-table">
                <tbody>
                    {s.charges.map((c) => (
                        <tr key={c.key}>
                            <td>
                                {c.title}
                                <span className="money__st-sub">
                                    {c.when}
                                    {c.people.length > 1 || c.people[0]?.name !== s.name
                                        ? ` · ${c.people.map((p) => `${p.name} ${exact(p.usd)}`).join(', ')}`
                                        : ` · share of ${exact(c.total)}`}
                                </span>
                            </td>
                            <td>{exact(c.usd)}</td>
                        </tr>
                    ))}
                    <tr className="money__st-total"><td>Total share</td><td>{exact(s.charged)}</td></tr>
                    {s.payments.map((p) => (
                        <tr key={`p-${p.key}`} className={p.usd < 0 ? 'money__st-got' : 'money__st-paid'}>
                            <td>{p.usd < 0 ? p.title : `Paid: ${p.title}`}<span className="money__st-sub">{p.when}</span></td>
                            <td>{p.usd < 0 ? `+${exact(-p.usd)}` : `−${exact(p.usd)}`}</td>
                        </tr>
                    ))}
                    <tr className="money__st-total"><td>{s.net < 0 ? 'Still owes' : s.net > 0 ? 'Overpaid by' : 'Balance'}</td><td>{exact(Math.abs(s.net))}</td></tr>
                </tbody>
            </table>

            {(out.length > 0 || back.length > 0) && (
                <p className="money__st-pay">
                    {out.map((t) => <span key={t.to}>Pays <b>{t.to}</b> {exact(t.usd)}</span>)}
                    {back.map((t) => <span key={t.from}>Gets <b>{exact(t.usd)}</b> from {t.from}</span>)}
                </p>
            )}

            <Button size="sm" type="button" onClick={copy}>{copied ? 'Copied' : 'Copy to send'}</Button>
        </details>
    );
};

/**
 * Settle up: the answer first. Who sends whom how much, then anything that
 * stops the answer being complete, each with a button to go and fix it.
 */
/**
 * Money that has already changed hands outside any booking ("Dad sent me
 * $2,200"). Each one counts toward settling up: the sender has paid that much
 * in, and the person who got it has that much less coming back.
 */
const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const SentMoney = ({ sent, travelers, onSent, fetchRate }) => {
    const [adding, setAdding] = useState(false);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState(BASE);
    const [rate, setRate] = useState('');
    const [date, setDate] = useState(today());
    const [note, setNote] = useState('');
    const [msg, setMsg] = useState(null);
    const [busy, setBusy] = useState(false);
    const cur = currency.trim().toUpperCase() || BASE;
    const foreign = cur !== BASE;
    const usdValue = Number(amount) > 0 ? round2(Number(amount) * (foreign ? Number(rate) || 0 : 1)) : 0;
    const ok = from && to && from !== to && usdValue > 0;
    const list = [...(sent || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    const clear = () => {
        setAdding(false); setFrom(''); setTo(''); setAmount(''); setCurrency(BASE);
        setRate(''); setDate(today()); setNote(''); setMsg(null);
    };
    const lookUp = async (c = cur) => {
        if (c === BASE) return;
        setMsg('Looking up the rate…');
        try {
            const r = await fetchRate(c, date);
            setRate(r.rate);
            setMsg(null);
        } catch {
            setMsg(`No rate found for ${c}. Type how many USD one ${c} is.`);
        }
    };
    const save = async (e) => {
        e.preventDefault();
        if (!ok || busy) return;
        setBusy(true);
        const entry = {
            id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            from, to, amount: Number(amount), currency: cur,
            fx_rate: foreign ? Number(rate) : 1, usd: usdValue,
            date: date || null, note: note.trim() || null,
        };
        try {
            await onSent([...(sent || []), entry]);
            clear();
        } catch {
            setMsg('That did not save. Try again.');
        } finally {
            setBusy(false);
        }
    };
    const remove = (id) => onSent((sent || []).filter((t) => t.id !== id));

    return (
        <div className="money__sent">
            <div className="money__sent-head">
                <h4 className="money__sub-head">Money already sent</h4>
                {!adding && travelers.length > 1 && (
                    <Button size="sm" type="button" onClick={() => { setAdding(true); setTo(travelers[0] || ''); }}>+ Record a payment</Button>
                )}
            </div>
            {!list.length && !adding && (
                <p className="money__hint">
                    {travelers.length > 1
                        ? 'If someone has already sent money toward the trip, record it here and it comes off what they owe.'
                        : 'Add who’s going first, on the People tab.'}
                </p>
            )}
            {list.length > 0 && (
                <ul className="money__sent-list">
                    {list.map((t) => (
                        <li key={t.id}>
                            <span className="money__sent-who"><b>{t.from}</b> sent <b>{t.to}</b></span>
                            <span className="money__sent-meta">
                                {t.date ? new Date(`${t.date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'}
                                {t.note ? ` · ${t.note}` : ''}
                                {t.currency && t.currency !== BASE ? ` · ${formatMoney(t.amount, t.currency)}` : ''}
                            </span>
                            <strong>{exact(t.usd)}</strong>
                            <button type="button" className="money__sent-x" aria-label={`Remove ${t.from} to ${t.to} ${exact(t.usd)}`} onClick={() => remove(t.id)}>×</button>
                        </li>
                    ))}
                </ul>
            )}
            {adding && (
                <form className="money__sent-form" onSubmit={save}>
                    <label><span>From</span>
                        <select className="select" value={from} onChange={(e) => setFrom(e.target.value)} required>
                            <option value="">Who sent it?</option>
                            {travelers.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                    <label><span>To</span>
                        <select className="select" value={to} onChange={(e) => setTo(e.target.value)} required>
                            {travelers.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                    <label><span>Amount</span>
                        <input className="input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                    </label>
                    <label><span>Currency</span>
                        <select className="select" value={cur} onChange={(e) => { setCurrency(e.target.value); setRate(''); lookUp(e.target.value); }}>
                            {[BASE, 'INR', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'SGD'].map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </label>
                    {foreign && (
                        <label><span>USD per {cur}</span>
                            <input className="input" type="number" min="0" step="any" value={rate} onChange={(e) => setRate(e.target.value)} />
                        </label>
                    )}
                    <label><span>Date</span>
                        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </label>
                    <label className="is-wide"><span>Note</span>
                        <input className="input" type="text" placeholder="e.g. Zelle, toward flights" value={note} onChange={(e) => setNote(e.target.value)} />
                    </label>
                    {from && to && from === to && <p className="money__hint is-wide">Pick two different people.</p>}
                    {msg && <p className="money__hint is-wide">{msg}</p>}
                    <div className="money__sent-acts is-wide">
                        {foreign && usdValue > 0 && <span className="money__hint">= {exact(usdValue)}</span>}
                        <Button size="sm" type="button" onClick={clear}>Cancel</Button>
                        <Button size="sm" variant="solid" type="submit" disabled={!ok || busy}>{busy ? 'Saving…' : 'Save'}</Button>
                    </div>
                </form>
            )}
        </div>
    );
};

const SettleUp = ({ summary, costs, onFix, tripName, sent, travelers, onSent, fetchRate }) => {
    const noPayer = costs.filter((c) => c.usd > 0 && !(c.split?.paid || []).some((p) => Number(p.usd) > 0));
    const byName = Object.fromEntries(summary.statements.map((x) => [x.name, x]));
    const [opened, setOpened] = useState(null);
    const why = (name) => {
        setOpened(name);
        setTimeout(() => document.getElementById(`statement-${name}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    };
    return (
        <div className="money__settle">
            {summary.settle.length ? (
                <ul className="money__transfers">
                    {summary.settle.map((t) => <Transfer key={`${t.from}-${t.to}`} t={t} st={byName[t.from]} onWhy={why} />)}
                </ul>
            ) : (
                <p className="money__even">{summary.people.length ? 'Everyone is even so far.' : 'Add who’s going to start.'}</p>
            )}

            {(noPayer.length > 0 || summary.unrated > 0) && (
                <div className="money__todo">
                    {noPayer.length > 0 && (
                        <button type="button" onClick={() => onFix('nopayer')}>
                            <b>{noPayer.length} {noPayer.length === 1 ? 'cost has' : 'costs have'} no payer yet</b>
                            <span>{usd0(summary.unpaid)} · not counted above</span>
                        </button>
                    )}
                    {summary.unrated > 0 && (
                        <button type="button" onClick={() => onFix('norate')}>
                            <b>{summary.unrated} {summary.unrated === 1 ? 'cost needs' : 'costs need'} a USD amount</b>
                            <span>not counted anywhere yet</span>
                        </button>
                    )}
                </div>
            )}
            {summary.statements.some((x) => x.charges.length || x.payments.length) && (
                <div className="money__statements">
                    <h4 className="money__sub-head">Everyone’s breakdown</h4>
                    {[...summary.statements]
                        .filter((x) => x.charges.length || x.payments.length)
                        .sort((a, b) => a.net - b.net)
                        .map((x) => <Breakdown key={x.name} s={x} transfers={summary.settle} tripName={tripName} open={opened === x.name} />)}
                </div>
            )}

            <SentMoney sent={sent} travelers={travelers} onSent={onSent} fetchRate={fetchRate} />

        </div>
    );
};

/**
 * People, grouped by who pays for them. "Pushkar pays for Geeta, Sanika,
 * Glenn and Yash" is one card with Pushkar at the top, instead of five table
 * rows each saying "covered by Pushkar".
 */
const People = ({ summary, travelers, rules }) => {
    const byName = Object.fromEntries(summary.people.map((p) => [p.name, p]));
    const everything = rules.filter((r) => (r.buckets || []).includes('all'));
    const groups = new Map();
    for (const name of travelers) {
        const head = responsibleFor(name, ALL, everything);
        if (!groups.has(head)) groups.set(head, []);
        if (name !== head) groups.get(head).push(name);
    }
    // A head who is not on the trip (Dad paying from home) still gets a card.
    const cards = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

    return (
        <div className="money__people-grid">
            {cards.map(([head, members]) => {
                const p = byName[head] || { share: 0, responsible: 0, paid: 0, net: 0, covers: {} };
                const partial = Object.entries(p.covers || {}).filter(([n]) => !members.includes(n));
                return (
                    <article key={head} className="money__card">
                        <header>
                            <h4>{head}</h4>
                            <span className={`money__net${p.net > 0.5 ? ' is-owed' : p.net < -0.5 ? ' is-owing' : ''}`}>
                                {p.net > 0.5 ? `gets back ${usd0(p.net)}` : p.net < -0.5 ? `owes ${usd0(-p.net)}` : 'even'}
                            </span>
                        </header>
                        <dl className="money__figures">
                            <div><dt>Pays for</dt><dd>{usd0(p.responsible)}</dd></div>
                            <div><dt>Has paid</dt><dd>{usd0(p.paid)}</dd></div>
                        </dl>
                        <ul className="money__members">
                            <li><span>{head}{members.length ? ' (own share)' : ''}</span><span>{usd0(p.share)}</span></li>
                            {members.map((m) => (
                                <li key={m}><span>{m}</span><span>{usd0(byName[m]?.share)}</span></li>
                            ))}
                            {partial.map(([n, v]) => (
                                <li key={`p-${n}`} className="money__partial">
                                    <span>{n}’s {bucketWords(rules.find((r) => r.person === n && r.payer === head)?.buckets || [])}</span>
                                    <span>{usd0(v)}</span>
                                </li>
                            ))}
                        </ul>
                    </article>
                );
            })}
        </div>
    );
};

/**
 * Who's going and who pays for whom, as one list: a row per person with a
 * "paid by" choice. Most people are covered for everything or not at all;
 * "only some of it" handles Neha-pays-Nadia's-hotels.
 */
const WhoPaysFor = ({ travelers, rules, onTravelers, onRules }) => {
    const [draft, setDraft] = useState('');
    const [partFor, setPartFor] = useState(null);
    const [partPayer, setPartPayer] = useState('');
    const [partBuckets, setPartBuckets] = useState([]);

    const add = (e) => {
        e.preventDefault();
        const name = draft.trim();
        if (!name || travelers.includes(name)) return;
        onTravelers([...travelers, name]);
        setDraft('');
    };
    const remove = (name) => {
        onTravelers(travelers.filter((n) => n !== name));
        onRules(rules.filter((r) => r.person !== name && r.payer !== name));
    };
    const allPayer = (name) => rules.find((r) => r.person === name && (r.buckets || []).includes('all'))?.payer || '';
    const setAllPayer = (name, payer) => {
        const rest = rules.filter((r) => !(r.person === name && (r.buckets || []).includes('all')));
        onRules(payer ? [...rest, { person: name, payer, buckets: ['all'] }] : rest);
    };
    const partials = (name) => rules
        .map((r, i) => ({ ...r, i }))
        .filter((r) => r.person === name && !(r.buckets || []).includes('all'));
    const savePart = () => {
        if (!partFor || !partPayer || !partBuckets.length) return;
        onRules([...rules, { person: partFor, payer: partPayer, buckets: partBuckets }]);
        setPartFor(null); setPartPayer(''); setPartBuckets([]);
    };

    return (
        <div className="money__who">
            <ul className="money__rows">
                {travelers.map((name) => {
                    const payer = allPayer(name);
                    return (
                        <li key={name} className="money__row">
                            <span className="money__name">{name}</span>
                            <select
                                className="select"
                                aria-label={`Who pays for ${name}`}
                                value={payer}
                                onChange={(e) => setAllPayer(name, e.target.value)}
                            >
                                <option value="">pays for themselves</option>
                                {travelers.filter((n) => n !== name).map((n) => <option key={n} value={n}>paid by {n}</option>)}
                            </select>
                            <span className="money__parts">
                                {partials(name).map((r) => (
                                    <span key={r.i} className="money__tag">
                                        {bucketWords(r.buckets)} by {r.payer}
                                        <button type="button" aria-label="Remove" onClick={() => onRules(rules.filter((_, j) => j !== r.i))}>×</button>
                                    </span>
                                ))}
                                {!payer && travelers.length > 1 && partFor !== name && (
                                    <button type="button" className="money__link" onClick={() => { setPartFor(name); setPartPayer(''); setPartBuckets([]); }}>
                                        + someone pays part
                                    </button>
                                )}
                            </span>
                            <button type="button" className="money__x" aria-label={`Remove ${name}`} onClick={() => remove(name)}>×</button>

                            {partFor === name && (
                                <div className="money__part-form">
                                    <select className="select" value={partPayer} onChange={(e) => setPartPayer(e.target.value)} aria-label="Who pays">
                                        <option value="">Who pays…</option>
                                        {travelers.filter((n) => n !== name).map((n) => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                    <span>pays {name}’s</span>
                                    {BUCKETS.map((b) => (
                                        <label key={b.id} className={`money__pill${partBuckets.includes(b.id) ? ' is-on' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={partBuckets.includes(b.id)}
                                                onChange={() => setPartBuckets(partBuckets.includes(b.id)
                                                    ? partBuckets.filter((x) => x !== b.id) : [...partBuckets, b.id])}
                                            />
                                            {b.label}
                                        </label>
                                    ))}
                                    <Button size="sm" variant="solid" disabled={!partPayer || !partBuckets.length} onClick={savePart}>Add</Button>
                                    <Button size="sm" onClick={() => setPartFor(null)}>Cancel</Button>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
            <form onSubmit={add} className="money__add">
                <input
                    className="input"
                    value={draft}
                    placeholder={travelers.length ? 'Add someone' : 'Who’s going? Type a name and press enter'}
                    aria-label="Add a traveler"
                    onChange={(e) => setDraft(e.target.value)}
                />
            </form>
        </div>
    );
};

const paidLine = (split) => {
    const paid = (split?.paid || []).filter((p) => Number(p.usd) > 0);
    if (!paid.length) return null;
    return paid.map((p) => `${p.name} ${usd0(p.usd)}`).join(', ');
};

/** Every priced thing on the trip, filterable to the ones that need attention. */
const Costs = ({ costs, filter, onFilter, onEdit }) => {
    const noPayer = (c) => c.usd > 0 && !(c.split?.paid || []).some((p) => Number(p.usd) > 0);
    const noRate = (c) => c.usd === null;
    const shown = costs.filter((c) => (filter === 'nopayer' ? noPayer(c) : filter === 'norate' ? noRate(c) : true));
    const chips = [
        { id: 'all', label: `All ${costs.length}` },
        { id: 'nopayer', label: `No payer ${costs.filter(noPayer).length}` },
        { id: 'norate', label: `Needs USD ${costs.filter(noRate).length}` },
    ];
    return (
        <div className="money__costs-wrap">
            <div className="money__chips">
                {chips.map((c) => (
                    <button key={c.id} type="button" className={`money__pill${filter === c.id ? ' is-on' : ''}`} onClick={() => onFilter(c.id)}>
                        {c.label}
                    </button>
                ))}
            </div>
            {shown.length === 0 ? <p className="money__hint">Nothing here.</p> : (
                <ul className="money__costs">
                    {shown.map((c) => (
                        <li key={c.key}>
                            <button type="button" className="money__cost" onClick={() => onEdit(c.key)}>
                                <span className="money__when">{c.when}</span>
                                <span className="money__what">
                                    <strong>{c.title}</strong>
                                    <span className={paidLine(c.split) ? '' : 'money__missing'}>
                                        {paidLine(c.split) ? `Paid by ${paidLine(c.split)}` : 'Who paid? Tap to add'}
                                    </span>
                                </span>
                                <span className="money__amt">
                                    {c.amount === null ? <em className="money__missing">No amount</em> : (
                                        <>
                                            <strong>{c.usd === null ? '—' : usd0(c.usd)}</strong>
                                            {c.currency !== BASE && <span>{formatMoney(c.amount, c.currency)}</span>}
                                            {c.usd === null && <span className="money__missing">needs USD</span>}
                                        </>
                                    )}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

/** The short version, for the sidebar beside the trip's totals. */
export const MoneyGlance = ({ money, onOpen }) => {
    const { summary } = money;
    if (!summary.people.length) {
        return <button type="button" className="money__glance" onClick={onOpen}>Who paid? Add who’s going →</button>;
    }
    return (
        <button type="button" className="money__glance" onClick={onOpen}>
            {summary.settle.length
                ? summary.settle.slice(0, 3).map((s) => (
                    <span key={`${s.from}-${s.to}`}>{s.from} → {s.to} <strong>{usd0(s.usd)}</strong></span>
                ))
                : <span>Everyone is even so far</span>}
            <em>Who paid →</em>
        </button>
    );
};

/**
 * Who paid what on this trip, full width. `money` is `useTripMoney`, called
 * once by the page and shared with the sidebar glance. Three tabs: settle up (the answer),
 * people (grouped by who pays for whom, with the editing list under it), and
 * costs (each one editable: amount, currency, USD, payers and shares).
 */
const TripMoney = ({ money, onTravelers, onRules, onSent, tripName }) => {
    const [tab, setTab] = useState('money-settle');
    const [filter, setFilter] = useState('all');
    const [editing, setEditing] = useState(null);
    const { summary, travelers, costs, rules } = money;
    const editingCost = useMemo(() => costs.find((c) => c.key === editing) || null, [costs, editing]);

    const fix = (which) => { setFilter(which); setTab('money-costs'); };

    return (
        <section className="money" id="who-paid">
            <header className="money__head">
                <h3 className="section-title">Who paid</h3>
                <span className="money__count">{travelers.length} {travelers.length === 1 ? 'person' : 'people'}</span>
            </header>

            <Tabs
                label="Who paid"
                variant="segmented"
                active={tab}
                onChange={setTab}
                tabs={[
                    { id: 'money-settle', label: 'Settle up', count: summary.settle.length || undefined },
                    { id: 'money-people', label: 'People', count: travelers.length || undefined },
                    { id: 'money-costs', label: 'Costs', count: costs.length || undefined },
                ]}
            />

            {tab === 'money-settle' && (
                <SettleUp
                    summary={summary} costs={costs} onFix={fix} tripName={tripName}
                    sent={money.sent} travelers={travelers} onSent={onSent} fetchRate={money.fetchRate}
                />
            )}

            {tab === 'money-people' && (
                <div className="money__people-tab">
                    {travelers.length > 0 && <People summary={summary} travelers={travelers} rules={rules} />}
                    <h4 className="money__sub-head">Who’s going, and who pays for whom</h4>
                    <WhoPaysFor travelers={travelers} rules={rules} onTravelers={onTravelers} onRules={onRules} />
                </div>
            )}

            {tab === 'money-costs' && (
                <Costs costs={costs} filter={filter} onFilter={setFilter} onEdit={setEditing} />
            )}

            {tab === 'money-costs' && money.rateNote && <p className="money__hint">{money.rateNote}</p>}

            <Modal open={Boolean(editingCost)} onClose={() => setEditing(null)} title="Edit cost" size="wide">
                <div className="money__modal">
                    {editingCost && (
                        <CostEditor
                            key={editingCost.key}
                            cost={editingCost}
                            travelers={travelers}
                            onSaveCost={money.saveCost}
                            onSaveSplit={money.saveSplit}
                            fetchRate={money.fetchRate}
                            onDone={() => setEditing(null)}
                        />
                    )}
                </div>
            </Modal>
        </section>
    );
};

export default TripMoney;
