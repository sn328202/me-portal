import React from 'react';
import { GiClockwork } from 'react-icons/gi';
import { Card, PageHeader, EmptyState } from '../components/ui';

/* The room is deliberately empty, not accidentally unfinished. Anything
   listed here should be something the portal genuinely lacks today. */
const PENCILLED_IN = [
    ['Routines', 'Recurring chores and rituals that schedule themselves instead of waiting to be re-entered.'],
    ['The archive', 'An export of every ledger in the house — provisions, library, treasury, plans — as one file you own.'],
    ['Connected spirits', 'One place to see whether the calendar, the news wire and the signal feed are actually answering.']
];

const Systems = () => {
    return (
        <div className="page">
            <PageHeader
                title="Systems"
                icon={<GiClockwork />}
                subtitle="The machinery under the floorboards. Nothing is wired up here yet."
            />

            <EmptyState
                icon={<GiClockwork />}
                message={'"Order is the sanity of the mind, the health of the body, the peace of the city."'}
                hint="— Module Under Construction —"
            />

            <Card title="Pencilled in for this room" variant="flat">
                <dl className="stack" style={{ margin: 0 }}>
                    {PENCILLED_IN.map(([term, detail]) => (
                        <div key={term}>
                            <dt className="section-title" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>{term}</dt>
                            <dd className="muted" style={{ margin: 0 }}>{detail}</dd>
                        </div>
                    ))}
                </dl>
            </Card>
        </div>
    );
};

export default Systems;
