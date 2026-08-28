import React, { useMemo } from 'react';
import { Button, Modal } from './ui';
import { dayCard } from '../utils/dayCard';
import '../styles/DayCard.css';

/**
 * A day, written out to send to someone.
 *
 * The editor is a working surface — input boxes, drag grips, delete buttons,
 * a board of maybes. None of that is what you send your mother the week
 * before she flies out. She wants one page: where to be, when, near enough an
 * address to find it, and enough of a picture to look forward to it.
 *
 * So this is not the editor with its chrome hidden. It is a different
 * document built from the same rows, and it prints. "Save as PDF" is in every
 * print dialog on every platform, which is a better PDF than any library
 * bundled into the page would produce and costs nothing to ship.
 *
 * The whole page is `position: fixed` while printing, so the app's own
 * scrolled, viewport-height layout cannot clip it at one page.
 */

const Stop = ({ stop, hop }) => (
    <>
        <li className="daycard__stop">
            <span className="daycard__face" aria-hidden="true">{stop.face}</span>

            <span className="daycard__when">
                {stop.at && <span className="daycard__at">{stop.at}</span>}
                {stop.length && <span className="daycard__length">{stop.length}</span>}
            </span>

            <span className="daycard__what">
                <span className="daycard__title">{stop.title}</span>
                {stop.place && (
                    <span className="daycard__place">
                        {stop.link ? (
                            /* Printed, this is a dead string — which is why the
                               address is the text and the link is only the
                               href. On a phone it is a tap to the map. */
                            <a href={stop.link} target="_blank" rel="noopener noreferrer">{stop.place}</a>
                        ) : stop.place}
                    </span>
                )}
                {stop.note && <span className="daycard__note">{stop.note}</span>}
            </span>

            {stop.cost ? <span className="daycard__cost">{stop.cost}</span> : null}
        </li>

        {hop && (
            <li className="daycard__hop">
                <span aria-hidden="true">🚗</span>
                <span>{hop.travel}</span>
                {hop.leaveBy && <em>leave by {hop.leaveBy}</em>}
            </li>
        )}
    </>
);

export const DayCardSheet = ({ card, footer }) => (
    <article className="daycard">
        <header className="daycard__head">
            <h1 className="daycard__name">{card.title}</h1>
            {card.date && <p className="daycard__date">{card.date}</p>}
            {card.subtitle && <p className="daycard__sub">{card.subtitle}</p>}
            {card.window && <p className="daycard__window">{card.window}</p>}
        </header>

        {card.empty ? (
            <p className="daycard__empty">Nothing on this day yet.</p>
        ) : (
            <ol className="daycard__stops">
                {card.stops.map((stop, i) => (
                    <Stop key={stop.id} stop={stop} hop={card.hops[i]} />
                ))}
            </ol>
        )}

        {card.loose.length > 0 && (
            <section className="daycard__maybe">
                <h2>If there's time</h2>
                <ul>
                    {card.loose.map((s) => (
                        <li key={s.id}>
                            <span aria-hidden="true">{s.face}</span> {s.title}
                            {s.place && <em> · {s.place}</em>}
                        </li>
                    ))}
                </ul>
            </section>
        )}

        {(card.spend || footer) && (
            <footer className="daycard__foot">
                {card.spend ? <span>Roughly {card.spend} all in</span> : <span />}
                {footer && <span className="daycard__mark">{footer}</span>}
            </footer>
        )}
    </article>
);

/**
 * The button, the preview and the print.
 *
 * Shown before it is printed because a printed page that turns out wrong is
 * a wasted trip to the printer, and because the preview is genuinely the nicer
 * way to read your own day back.
 */
const DayCard = ({ title, date, subtitle, items = [], travel = {}, open, onClose }) => {
    const card = useMemo(
        () => dayCard({ title, date, subtitle, items, travel }),
        [title, date, subtitle, items, travel]
    );

    return (
        <Modal open={open} onClose={onClose} title="Send this day to someone" size="wide">
            <div className="daycard__wrap">
                <DayCardSheet card={card} footer="made in the Me Portal" />
            </div>

            <div className="daycard__actions no-print">
                <Button variant="primary" onClick={() => window.print()}>
                    Print / Save as PDF
                </Button>
                <Button variant="ghost" onClick={onClose}>Close</Button>
            </div>

            <p className="daycard__hint no-print">
                In the print dialog, choose <strong>Save as PDF</strong> as the destination.
            </p>
        </Modal>
    );
};

export default DayCard;
