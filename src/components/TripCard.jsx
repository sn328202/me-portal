import React, { useMemo, useRef, useState } from 'react';
import { Button, Modal } from './ui';
import { DayCardSheet, SheetActions } from './DayCard';
import { tripCard } from '../utils/dayCard';
import { shotName } from '../utils/sheetImage';
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

    const shot = useRef(null);

    return (
        <>
            <Button onClick={() => setOpen(true)}>📮 Share sheet</Button>

            <Modal open={open} onClose={() => setOpen(false)} title="Send this trip to someone" size="wide">
                <div className="daycard__wrap">
                    <div className="daycard__shot" ref={shot}>
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
                </div>

                <SheetActions
                    node={shot}
                    name={shotName(card.title, trip?.start_date)}
                    title={card.title}
                    onClose={() => setOpen(false)}
                />
            </Modal>
        </>
    );
};

export default TripCard;
