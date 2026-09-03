import React from 'react';
import { Card } from './ui';
import { COST_BUCKETS, formatMoney } from '../utils/tripCosts';

const BUCKET_LABEL = {
    lodging: 'Lodging',
    food: 'Food',
    excursions: 'Excursions',
    transport: 'Transport',
    points: 'Points',
};

/**
 * What the trip costs.
 *
 * Lifted out of the planner so it can stand beside Where and when rather than
 * under it. Both are short, wide things; stacked full-width they were two
 * bands of mostly empty paper, the figures flung to one edge and the labels
 * to the other. Side by side they are a page.
 *
 * It reads as a column now rather than a row, because it is a sidebar: the two
 * totals stack, the party field sits under them, and the buckets run down
 * instead of across.
 */
const TripLedger = ({ costs, currency = 'USD', party = 1, onParty }) => (
    <Card className="trip-ledger">
        <div className="trip-ledger__totals">
            <div>
                <span className="trip-ledger__figure">{formatMoney(costs.perPerson, currency)}</span>
                <span className="trip-ledger__caption">per person</span>
            </div>
            <div>
                <span className="trip-ledger__figure">{formatMoney(costs.party, currency)}</span>
                <span className="trip-ledger__caption">
                    for {party} {party === 1 ? 'person' : 'people'}
                </span>
            </div>
        </div>

        <label className="trip-ledger__party">
            <span>Party</span>
            <input
                type="number"
                min="1"
                value={party}
                onChange={(e) => onParty?.(Math.max(1, Number(e.target.value) || 1))}
            />
        </label>

        <ul className="trip-ledger__buckets">
            {COST_BUCKETS.map((b) => (
                <li key={b}>
                    <span>{BUCKET_LABEL[b]}</span>
                    <strong>{formatMoney(costs.totals[b], currency)}</strong>
                </li>
            ))}
        </ul>
    </Card>
);

export default TripLedger;
