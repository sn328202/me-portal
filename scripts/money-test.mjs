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
check('paid, share, net', b.people.map((p) => [p.name, p.paid, p.share, p.net]), [['Neha', 300, 145, 155], ['Adeesh', 90, 145, -55], ['Priya', 0, 100, -100]]);
check('unpaid kept out and counted', [b.unpaid, b.unpaidCount], [60, 1]);
check('settle up', m.settleUp(b.people), [{ from: 'Priya', to: 'Neha', usd: 100 }, { from: 'Adeesh', to: 'Neha', usd: 55 }]);

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
