import React from 'react';

/**
 * A place's photo, when there is one that still works.
 *
 * The Maps JS API hands out `PhotoService.GetPhoto` URLs, which are bound to
 * the session that asked for them and expire. Cached in `place_data` months
 * ago, every one of them now returns Google's own "image unavailable"
 * graphic — a little map with a red cross through it. Which loads perfectly,
 * so `onerror` never fires and the card cheerfully shows a broken picture.
 *
 * They are treated as no photo at all. The place's own name and address were
 * always the useful part, and an empty tile on every card is worse than the
 * width it costs — so when there is nothing to show, nothing is drawn.
 */
const EXPIRING = /PhotoService\.GetPhoto/;

const PlaceImage = ({ photo, className = '', fallback = null }) => {
    const [failed, setFailed] = React.useState(false);
    const [loaded, setLoaded] = React.useState(false);

    const url = photo?.url && !EXPIRING.test(photo.url) ? photo.url : null;

    React.useEffect(() => {
        if (!url) return undefined;
        let alive = true;
        const img = new Image();
        img.onload = () => { if (alive) setLoaded(true); };
        img.onerror = () => { if (alive) setFailed(true); };
        img.src = url;
        return () => { alive = false; };
    }, [url]);

    // No photo, or a URL that loaded a "no image" placeholder: show the
    // fallback rather than a gap. Most cards land here.
    if (!url || failed) return fallback;
    if (!loaded) return <div className={`place-image place-image--empty ${className}`} />;

    return (
        <div
            className={`place-image ${className}`}
            style={{ backgroundImage: `url(${url})` }}
        />
    );
};

export default PlaceImage;
