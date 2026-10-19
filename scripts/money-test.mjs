/** Currencies, shares, balances and settling up. */
const m = await import('../src/utils/money.js');
const { tripCost } = await import('../src/utils/tripCosts.js');
const { parseRate } = await import('../api/fx.js');

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

console.log('converting');
check('USD is itself', m.usdOf({ cost: 120 }), 120);
check('foreign with a rate', m.usdOf({ cost: 10000, currency: 'inr', fx_rate: 0.012 }), 120);
check('foreign with no rate is not counted as dollars', m.usdOf({ cost: 10000, currency: 'INR' }), null);
check('needs a rate', [m.needsRate({ cost: 5, currency: 'EUR' }), m.needsRate({ cost: 5, currency: 'EUR', fx_rate: 1.1 }), m.needsRate({ cost: 5 })], [true, false, false]);
check('typed USD becomes a rate', m.rateFor(10000, 118.5), 0.01185);
check('fx api shapes', [parseRate({ rate: 1.08 }), parseRate({ rates: { USD: 0.012 } }), parseRate({})], [1.08, 0.012, null]);

console.log('trip totals use USD');
const t = tripCost([{ id: 1, date: '2026-11-01' }], { 1: [{ cost: 10000, currency: 'INR', fx_rate: 0.012, kind: 'food' }, { cost: 50, kind: 'food' }, { cost: 999, currency: 'EUR', kind: 'food' }] }, 1, []);
check('rupees converted, unrated left out', t.totals.food, 170);
const st = tripCost([{ id: 1, date: '2026-11-01' }, { id: 2, date: '2026-11-02' }], {}, 2, [{ check_in: '2026-11-01', check_out: '2026-11-03', cost: 20000, currency: 'INR', fx_rate: 0.012 }]);
check('stay converted and shared', st.totals.lodging, 120);

console.log('shares');
check('equal split, spare cent to the first', m.sharesOf(100, null, ['A', 'B', 'C']), { A: 3334, B: 3333, C: 3333 });
check('custom shares', m.sharesOf(100, [{ name: 'A', usd: 70 }, { name: 'B', usd: 30 }], ['A', 'B', 'C']), { A: 7000, B: 3000 });
check('equal among some', m.equalAmong(90, ['A', 'B']), [{ name: 'A', usd: 45 }, { name: 'B', usd: 45 }]);
check('paid gap', [m.paidGap(100, [{ usd: 60 }, { usd: 40 }]), m.paidGap(100, [{ usd: 60 }])], [0, 40]);

console.log('balances');
const b = m.balances([
    { usd: 300, split: { paid: [{ name: 'Neha', usd: 300 }], owed: null } },
    { usd: 90, split: { paid: [{ name: 'Adeesh', usd: 90 }], owed: [{ name: 'Neha', usd: 45 }, { name: 'Adeesh', usd: 45 }] } },
    { usd: 60, split: null },
], ['Neha', 'Adeesh', 'Priya']);
check('paid, share (all costs), net (paid costs)', b.people.map((p) => [p.name, p.paid, p.share, p.net]), [['Neha', 300, 165, 155], ['Adeesh', 90, 165, -55], ['Priya', 0, 120, -100]]);
check('unpaid kept out and counted', [b.unpaid, b.unpaidCount], [60, 1]);
check('settle up', m.settleUp(b.people), [{ from: 'Priya', to: 'Neha', usd: 100 }, { from: 'Adeesh', to: 'Neha', usd: 55 }]);

console.log('someone paying for someone else');
const rules = [
    { person: 'Geeta', payer: 'Dad', buckets: ['all'] },
    { person: 'Sanika', payer: 'Dad', buckets: ['all'] },
    { person: 'Nadia', payer: 'Neha', buckets: ['lodging'] },
];
check('rule lookup', [m.responsibleFor('Geeta', 'transport', rules), m.responsibleFor('Nadia', 'lodging', rules), m.responsibleFor('Nadia', 'transport', rules)], ['Dad', 'Neha', 'Nadia']);
check('chained, and a loop does not hang', [m.responsibleFor('A', 'food', [{ person: 'A', payer: 'B', buckets: ['all'] }, { person: 'B', payer: 'C', buckets: ['food'] }]), m.responsibleFor('A', 'food', [{ person: 'A', payer: 'B', buckets: ['all'] }, { person: 'B', payer: 'A', buckets: ['all'] }])], ['C', 'A']);
const fam = ['Dad', 'Geeta', 'Sanika', 'Neha', 'Nadia'];
const c = m.balances([
    { usd: 500, source: 'stay', split: { paid: [{ name: 'Neha', usd: 500 }], owed: null } },
    { usd: 1000, row: { kind: 'transport' }, split: { paid: [{ name: 'Dad', usd: 1000 }], owed: null } },
], fam, rules);
const row = (n) => c.people.find((p) => p.name === n);
check('everyone still has their own share', fam.map((n) => row(n).share), [300, 300, 300, 300, 300]);
check('Dad is responsible for himself, Geeta and Sanika', row('Dad').responsible, 900);
check('Neha covers Nadia\'s hotel only', [row('Neha').covers, row('Nadia').coveredBy, row('Nadia').responsible], [{ Nadia: 100 }, { Neha: 100 }, 200]);
check('nets', fam.map((n) => row(n).net), [100, 0, 0, 100, -200]);
check('settle', m.settleUp(c.people), [{ from: 'Nadia', to: 'Dad', usd: 100 }, { from: 'Nadia', to: 'Neha', usd: 100 }]);

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
