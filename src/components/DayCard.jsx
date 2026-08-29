import React, { useMemo, useRef, useState } from 'react';
import { Button, Modal } from './ui';
import { dayCard } from '../utils/dayCard';
import { saveSheetImage, shotName } from '../utils/sheetImage';
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
 * document built from the same rows, and what she sees is what she sends:
 * the sheet is photographed off the screen, colour and all, into one tall
 * image. Printing is still there for anyone who wants paper, but it is no
 * longer the way the pretty version leaves the building.
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
 * Take the picture, or fall back to paper.
 *
 * The photograph is the headline because it is the thing she asked for: the
 * preview, as it looks, in a file she can drop into a message. Printing is
 * kept because a four-day trip reads better as four sheets of paper than as
 * one very tall picture, and because paper does not need a battery.
 */
export const SheetActions = ({ node, name, title, onClose }) => {
    const [busy, setBusy] = useState(false);
    const [said, setSaid] = useState(null);

    const take = async () => {
        setBusy(true);
        setSaid(null);
        try {
            const how = await saveSheetImage(node?.current, {
                name,
                title,
                background: readBackground(node?.current),
            });
            if (how === 'saved') setSaid('Saved to your downloads.');
            else if (how === 'shared') setSaid('Sent.');
            else setSaid(null);
        } catch (err) {
            setSaid(`That did not come out: ${err?.message || 'unknown error'}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <div className="daycard__actions no-print">
                <Button variant="primary" onClick={take} disabled={busy}>
                    {busy ? 'Taking the picture…' : '🖼 Save as image'}
                </Button>
                <Button variant="ghost" onClick={() => window.print()}>🖨 Print</Button>
                <Button variant="ghost" onClick={onClose}>Close</Button>
            </div>

            <p className="daycard__hint no-print">
                {said || 'The image is exactly what you see above — colour and all.'}
            </p>
        </>
    );
};

/**
 * The colour behind the sheet.
 *
 * A photograph of a transparent thing is a photograph of nothing, so the
 * ground the sheet is standing on is read off the page and painted in. It is
 * whatever theme she is running, which is the point.
 */
const readBackground = (el) => {
    let at = el;
    while (at && at !== document.documentElement) {
        const paint = getComputedStyle(at).backgroundColor;
        if (paint && paint !== 'transparent' && !/rgba\(0,\s*0,\s*0,\s*0\)/.test(paint)) return paint;
        at = at.parentElement;
    }
    return '#ffffff';
};

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

    const shot = useRef(null);

    return (
        <Modal open={open} onClose={onClose} title="Send this day to someone" size="wide">
            <div className="daycard__wrap">
                <div className="daycard__shot" ref={shot}>
                    <DayCardSheet card={card} footer="made in the Me Portal" />
                </div>
            </div>

            <SheetActions node={shot} name={shotName(card.title, date)} title={card.title} onClose={onClose} />
        </Modal>
    );
};

export default DayCard;
