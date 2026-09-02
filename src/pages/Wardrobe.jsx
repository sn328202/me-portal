import React, { useCallback, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { wardrobeCss } from '../utils/wardrobeTheme';
import { useWardrobeBackup } from '../hooks/useWardrobeBackup';
import { atlasIdFrom, readTrips } from '../utils/wardrobeLink';
import '../styles/Wardrobe.css';

/**
 * The Wardrobe is a self-contained outfit + trip + packing planner. It lives as
 * a standalone HTML app in /public and is embedded here full-bleed so its own
 * state (localStorage) and behaviour carry over untouched. Served statically
 * via the vercel.json rewrite exemption for /outfit-planner.html.
 *
 * What it did not carry over was the vibe. Its palette is where the Studio
 * theme came from, so under Studio the seam is invisible — and under any of the
 * other twelve it was a bright rectangle sitting inside a dark room.
 *
 * The iframe is same-origin, so rather than restyling it a second time the
 * portal reads its own tokens off :root and hands them across as the planner's
 * own variables. One palette, two documents. The planner keeps its defaults for
 * when it is opened on its own.
 *
 * Same-origin is also why the closet is no longer one cleared browser away from
 * gone. The portal reconciles the planner's storage with the account before the
 * planner is allowed to start, and listens to its writes afterwards. The
 * planner itself is not modified — it still believes localStorage is the world.
 *
 * And it is why `/wardrobe?trip=atlas-11` can land on a trip. The planner has
 * a global `openTrip(id)`; the portal calls it once the frame is up. Arriving
 * at a list of trips having just clicked "open in the Wardrobe" from one
 * particular trip is the sort of small betrayal that makes a link not worth
 * following, and the way back to the Atlas goes with it.
 */
export default function Wardrobe() {
    const frame = useRef(null);
    const { themeId } = useTheme();
    const { ready, status, failed, note, backedUp } = useWardrobeBackup();

    const [params] = useSearchParams();
    const wanted = params.get('trip');
    // Only a trip that came from the Atlas has somewhere to go back to.
    const cameFrom = atlasIdFrom(wanted);

    // Held in a ref so the wrapper installed on the planner's storage keeps
    // reaching the current one without being reinstalled.
    const noteRef = useRef(note);
    useEffect(() => { noteRef.current = note; }, [note]);

    const paint = useCallback(() => {
        const doc = frame.current?.contentDocument;
        // A cross-origin iframe throws on contentDocument rather than returning
        // null, and a not-yet-loaded one has no <head> to hang anything off.
        if (!doc?.head) return;

        const read = (name) => getComputedStyle(document.documentElement)
            .getPropertyValue(name);

        const css = wardrobeCss(read);
        if (!css) return;

        let tag = doc.getElementById('portal-theme');
        if (!tag) {
            tag = doc.createElement('style');
            tag.id = 'portal-theme';
            // Appended last so it wins on order against the planner's own
            // :root block, which has identical specificity.
            doc.head.appendChild(tag);
        }
        tag.textContent = css;
    }, []);

    /**
     * Listen to the planner saving.
     *
     * Its own `setItem` is wrapped rather than polled, so a save is noticed the
     * instant it happens and nothing is read on a timer. The wrapper lives on
     * the iframe's own Storage instance, so the portal's storage is untouched.
     */
    const listen = useCallback((el) => {
        const win = el?.contentWindow;
        if (!win || win.__portalWatching) return;

        try {
            const store = win.localStorage;
            const write = store.setItem.bind(store);
            store.setItem = (key, value) => {
                write(key, value);
                if (typeof key === 'string' && key.startsWith('op_')) {
                    noteRef.current?.(key.slice(3));
                }
            };
            win.__portalWatching = true;
        } catch {
            // If this browser will not let us near the iframe's storage, the
            // planner still works — it is just this session's edits that will
            // wait for the next load to be pushed.
        }
    }, []);

    /**
     * Land on the trip that was asked for.
     *
     * Guarded on the trip actually being there: `openTrip` sets the current id
     * and renders the detail view from it, so a name for a trip that does not
     * exist is a blank page rather than a missing one. Nothing to open is not
     * an error — it is a trip that has never been sent across, and the list is
     * a perfectly good place to arrive.
     */
    const openWanted = useCallback((el) => {
        if (!wanted) return;
        const win = el?.contentWindow;
        if (typeof win?.openTrip !== 'function') return;
        try {
            if (!readTrips(win.localStorage).some((t) => t.id === wanted)) return;
            win.openTrip(wanted);
        } catch {
            // A browser that will not let us near the frame keeps the list.
        }
    }, [wanted]);

    const started = useCallback((e) => {
        paint();
        listen(e.currentTarget);
        openWanted(e.currentTarget);
    }, [paint, listen, openWanted]);

    // Re-paint on every theme change. The iframe is not remounted, so nothing
    // else would tell it the room had changed colour.
    useEffect(() => { paint(); }, [paint, themeId]);

    return (
        <div style={{ position: 'absolute', inset: 0 }}>
            {ready ? (
                <iframe
                    ref={frame}
                    src="/outfit-planner.html"
                    title="The Wardrobe — outfit & trip planner"
                    onLoad={started}
                    style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
                />
            ) : (
                <p className="wardrobe__waiting">Fetching your wardrobe…</p>
            )}

            {/* The way home. Only when she arrived from a trip — on its own
                the Wardrobe is a room, not a subpage of the Atlas. */}
            {cameFrom && (
                <Link className="wardrobe__back" to={`/atlas?trip=${encodeURIComponent(cameFrom)}`}>
                    ← Back to the trip
                </Link>
            )}

            {failed && (
                <p className="wardrobe__note wardrobe__note--bad" role="status">
                    Not backed up — {failed}. Your wardrobe is safe in this browser; it will save itself when the connection comes back.
                </p>
            )}

            {/* Worth reading once, not staring at, so it fades itself out.
                Keyed on the text so a new message starts the fade again. */}
            {!failed && status && (
                <p key={status} className="wardrobe__note wardrobe__note--fades" role="status">{status}</p>
            )}

            {!failed && !backedUp && (
                <p className="wardrobe__note wardrobe__note--bad" role="status">
                    Signed out — this wardrobe lives only in this browser.
                </p>
            )}
        </div>
    );
}
