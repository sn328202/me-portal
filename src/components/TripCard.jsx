import React, { useMemo, useState } from 'react';
import { Button, Modal } from './ui';
import { DayCardSheet } from './DayCard';
import { tripCard } from '../utils/dayCard';
import '../styles/DayCard.css';

/**
 * A whole trip, written out to send to whoever is coming.
 *
 * The same document as a single day, once per day that has anything on it.
 * Empty days are dropped rather than printed as a heading over nothing — a
 * trip is planned unevenly and the gaps are not information.
 *
 * A page break before each day, so the thing that comes off the printer is
 * one sheet per day and can be handed round.
 */
const TripCard = ({ trip, days = [], itemsByDay = {} }) => {
    const [open, setOpen] = useState(false);

    const card = useMemo(
        () => tripCard({ trip, days, itemsByDay }),
        [trip, days, itemsByDay]
    );

    return (
        <>
            <Button onClick={() => setOpen(true)}>📮 Share sheet</Button>

            <Modal open={open} onClose={() => setOpen(false)} title="Send this trip to someone" size="wide">
                <div className="daycard__wrap">
                    <div className="daycard__trip-head">
                        <h1>{card.title}</h1>
                        {card.subtitle && <p>{card.subtitle}</p>}
                    </div>

                    {card.days.length === 0 ? (
                        <p className="daycard__empty">Nothing is planned on any day yet.</p>
                    ) : card.days.map((day, i) => (
                        <div key={day.title + i} className="daycard__page">
                            <DayCardSheet
                                card={day}
                                footer={i === card.days.length - 1 ? 'made in the Me Portal' : null}
                            />
                        </div>
                    ))}
                </div>

                <div className="daycard__actions no-print">
                    <Button variant="primary" onClick={() => window.print()}>
                        Print / Save as PDF
                    </Button>
                    <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
                </div>

                <p className="daycard__hint no-print">
                    In the print dialog, choose <strong>Save as PDF</strong> as the destination.
                </p>
            </Modal>
        </>
    );
};

export default TripCard;
