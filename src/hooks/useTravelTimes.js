import { useEffect, useRef, useState } from 'react';
import { legsOf, legsSignature, unanswered, timesFor } from '../utils/travelLegs';

/**
 * Drive times between the stops of a day, asked for once each.
 *
 * The version this replaces called Google once per gap inside an effect keyed
 * on `items` — a new array on every keystroke. Typing a letter into a title
 * fired a burst of Distance Matrix requests, the burst hit the per-second
 * quota, and the empty result was then written over the answers already on
 * screen. Which is why the drive times seemed to disappear.
 *
 * Three things fix it. The effect watches the *addresses in order*, so
 * renaming a stop costs nothing. Answers are cached by the pair of addresses,
 * so a pair is never asked about twice however much the day is rearranged.
 * And the cache is merged into, never replaced, so a failed lookup leaves what
 * is already known alone.
 */

const DEBOUNCE = 400;

export const useTravelTimes = (timelineItems, isLoaded) => {
    /* Answers by "from→to". A ref rather than state: it is a store, and
       writing to it must not itself cause the render that reads it. */
    const cache = useRef({});
    const [, bump] = useState(0);

    const signature = legsSignature(timelineItems);

    useEffect(() => {
        if (!isLoaded || !window.google?.maps) return undefined;

        const legs = legsOf(timelineItems);
        const todo = unanswered(legs, cache.current);
        if (!todo.length) return undefined;

        let alive = true;
        const timer = setTimeout(async () => {
            const service = new window.google.maps.DistanceMatrixService();
            try {
                /* One request for the whole day rather than one per gap. The
                   answer is a grid; the drives wanted are its diagonal. */
                const res = await service.getDistanceMatrix({
                    origins: todo.map((l) => l.from),
                    destinations: todo.map((l) => l.to),
                    travelMode: 'DRIVING',
                });
                if (!alive) return;

                todo.forEach((leg, i) => {
                    const cell = res.rows?.[i]?.elements?.[i];
                    // Only an answer is cached. A failure is left unknown, so
                    // it can be asked again later rather than remembered as
                    // "there is no drive here".
                    if (cell?.status === 'OK') cache.current[leg.key] = cell.duration.text;
                });
                bump((n) => n + 1);
            } catch (err) {
                // Quota, network, a place Google cannot route to. None of them
                // is a reason to forget the drives already worked out.
                console.error('Could not work out the drive times:', err?.message || err);
            }
        }, DEBOUNCE);

        return () => { alive = false; clearTimeout(timer); };
        // `signature` is the dependency that matters — see legsSignature.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature, isLoaded]);

    const legs = legsOf(timelineItems);
    return { times: timesFor(legs, cache.current), legs };
};

export default useTravelTimes;
