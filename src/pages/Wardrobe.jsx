import React, { useCallback, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { wardrobeCss } from '../utils/wardrobeTheme';

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
 */
export default function Wardrobe() {
    const frame = useRef(null);
    const { themeId } = useTheme();

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

    // Re-paint on every theme change. The iframe is not remounted, so nothing
    // else would tell it the room had changed colour.
    useEffect(() => { paint(); }, [paint, themeId]);

    return (
        <div style={{ position: 'absolute', inset: 0 }}>
            <iframe
                ref={frame}
                src="/outfit-planner.html"
                title="The Wardrobe — outfit & trip planner"
                onLoad={paint}
                style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
            />
        </div>
    );
}
