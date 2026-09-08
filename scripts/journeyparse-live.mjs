/**
 * Four real-shaped confirmations through the actual prompt.
 *
 * Not part of `npm test` — it costs money and needs ANTHROPIC_API_KEY, so it
 * is run by hand before shipping a change to the prompt:
 *
 *     vercel env pull /tmp/venv --environment=production --yes
 *     env $(grep ANTHROPIC /tmp/venv | tr -d '\"') node scripts/journeyparse-live.mjs
 *
 * The question it answers is not "does it parse" — `journeyparse-test.mjs`
 * covers everything downstream of the model without spending anything. The
 * question is the one no unit test can ask: **does it leave the two clocks
 * alone.** A model handed "09:00 PDT → 18:00 EDT" will helpfully normalise
 * them if the prompt lets it, and a normalised departure time is the exact
 * mistake this table was rebuilt to stop making.
 *
 * The four cases are the four ways that goes wrong:
 *   1. a round trip with a connection — four legs, none merged, none dropped;
 *   2. times explicitly labelled PDT and EDT — the labels are the temptation;
 *   3. westward over the date line, landing at an earlier clock the same day;
 *   4. rail, with no arrival date printed at all;
 *   5. the Chase Travel itinerary that actually failed — times in one block,
 *      dates two hundred lines away in the cancellation table, four segments
 *      timed nowhere, and "2nd day arrival" on a 12-hour clock.
 *
 * Case 5 is the one to check first. Every other case passed by construction;
 * that one is here because the parser got it wrong on a real booking.
 */
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../api/journey-parse.js', import.meta.url), 'utf8');
const SYSTEM = src.slice(src.indexOf('const SYSTEM = `')+16, src.indexOf('`;', src.indexOf('const SYSTEM = `')));
const SCHEMA = await import('../api/journey-parse.js');
// rebuild the tool schema by evaluating the module's constants indirectly
const toolSrc = src.slice(src.indexOf('const LEG = {'), src.indexOf('const SYSTEM'));
const LEG_AND_SCHEMA = new Function(`${toolSrc}; return SCHEMA;`)();

const CASES = {
  'Chase Travel, dates in the cancellations table (the one that failed)': `
Chase Travel — Trip ID: 1019650217
Hi NEHA, Thank you for choosing Chase Travel.

Flight   $1,621.39
Wed, Dec 23, 2026 - Thu, Jan 07, 2027
1 traveler
Airline confirmation: AW39KT
Los Angeles (LAX) to Mumbai (BOM)
Mumbai (BOM) to San Francisco (SFO)

Flight 1:
05:30 pm LAX to 11:55 pm BOM
2nd day arrival
40h 55m | 1 Stop (MUC — 22h 0m)
Lufthansa German Airlines
LH 453  Airbus A380-800 Passenger
LH 766  Airbus A350-900 XWB
Fare: Economy Comfort, economy class H
Included in fare : Checked bags, Carry-on bag, Exchange
Available for fee : Seats
Not included: Refund

Flight 2:
01:35 am BOM to 07:35 pm SFO
31h 30m | 1 Stop (MUC — 10h 45m)
Lufthansa German Airlines
LH 767  Airbus A350-900 XWB
LH 458  Airbus A380-800 Passenger
Fare: Economy Comfort, economy class K
Included in fare : Checked bags, Carry-on bag, Exchange

Traveler 1: Neha Pushkar Sule

Payment summary
LAX to BOM
BOM to SFO
$1,621.39
Trip total $1,621.39
Points redeemed 108,092 pts

Rules, policies, and cancellations
LAX to BOM
Wed, Dec 23, 2026 - Fri, Dec 25, 2026
BOM to SFO
Thu, Jan 07, 2027 - Thu, Jan 07, 2027
Seat assignments not available until after check-in
Refunds and ticket changes are not permitted
This ticket is non-refundable.
`,
  'round trip with a connection, United': `
Subject: Your trip to London is confirmed — confirmation XQ7R2P

Passenger: NEHA SULE          Booking reference: XQ7R2P

DEPART  Wed, Sep 16, 2026
UA 512  San Francisco (SFO) 9:00 AM  →  New York/Newark (EWR) 5:35 PM
        Duration 5h 35m · Economy · Seat 14A
        Connect in EWR — 1h 40m

UA 934  New York/Newark (EWR) 7:15 PM  →  London Heathrow (LHR) 7:30 AM (+1)
        Duration 7h 15m · Economy · Seat 22C

RETURN  Mon, Sep 28, 2026
UA 935  London Heathrow (LHR) 11:00 AM  →  San Francisco (SFO) 2:20 PM
        Duration 11h 20m · Economy

Baggage: 1 checked bag 23kg included
Total paid: USD 1,486.20
`,
  'eastbound, times labelled with zones': `
Delta — Your flight is booked. Confirmation GJK88P
DL 415  Wed 16 Sep 2026
Depart  09:00 PDT  San Francisco SFO Terminal 1
Arrive  18:00 EDT  New York JFK Terminal 4
Flight time 6h 05m. Main Cabin. 1 free checked bag.
`,
  'westbound over the date line, ANA': `
ANA e-Ticket Itinerary — Reference ANA771
NH 006  Departure: 16 SEP 2026 17:00  TOKYO HANEDA (HND)
        Arrival:   16 SEP 2026 10:00  LOS ANGELES (LAX)
        Flying time 09H55M
Fare: JPY 142,000
`,
  'rail, no arrival date given': `
Eurostar booking 9024 confirmed. Ref EU9024
Sun 27 September 2026
London St Pancras International dep 08:01
Paris Gare du Nord arr 11:17
Standard Premier. Journey time 2h 16m. GBP 96.00
`,
};

const results = {};
for (const [name, text] of Object.entries(CASES)) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{'content-type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
    body: JSON.stringify({ model:'claude-sonnet-5', max_tokens:4096, system:SYSTEM,
      tools:[LEG_AND_SCHEMA], tool_choice:{type:'tool',name:'journey'},
      messages:[{role:'user',content:`Today is 2026-09-07.\n\n${text}`}] }),
  });
  if (!r.ok) { console.log(name, 'HTTP', r.status, (await r.text()).slice(0,200)); continue; }
  const reply = await r.json();
  const call = (reply.content||[]).find(c=>c.type==='tool_use');
  results[name] = SCHEMA.cleanLegs(call?.input?.legs);
}
for (const [name, r] of Object.entries(results)) {
  console.log(`\n=== ${name}  (${r.legs.length} legs${r.dropped ? `, ${r.dropped} DROPPED` : ''})`);
  for (const l of r.legs) {
    console.log('   ', [
      l.from_place + '->' + l.to_place,
      l.depart_date + ' ' + l.depart_time,
      '=>', (l.arrive_date || '?') + ' ' + (l.arrive_time || '?'),
      l.carrier, l.number,
      'dur=' + (l.duration || '-'),
      'conf=' + (l.confirmation || '-'),
      'cost=' + (l.cost ?? '-') + (l.currency || ''),
    ].join('  '));
    if (l.notes) console.log('      note:', l.notes);
  }
}
