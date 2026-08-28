import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Places matching what is being typed, debounced and never out of order.
 *
 * Two things make this harder than it looks. Every keystroke is a billed API
 * call unless it is debounced, so it is. And typing "mas" then "masq" starts
 * two requests, and there is no guarantee the second comes back second — so
 * each request carries the query it was for, and an answer to a question that
 * is no longer being asked is dropped rather than rendered.
 */

const DEBOUNCE = 280;

export const usePlaceSearch = (query, city) => {
    const [results, setResults] = useState([]);
    const [busy, setBusy] = useState(false);
    /* The query the newest request was for. An older reply that arrives late
       is discarded by comparing against this. */
    const latest = useRef('');

    useEffect(() => {
        const text = String(query ?? '').trim();
        latest.current = text;

        if (text.length < 2) {
            setResults([]);
            setBusy(false);
            return undefined;
        }

        setBusy(true);
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch('/api/place-search', {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        Authorization: `Bearer ${session?.access_token || ''}`,
                    },
                    body: JSON.stringify({ q: text, city: city || null }),
                    signal: controller.signal,
                });
                const json = await res.json();
                if (latest.current !== text) return;
                setResults(json.ok ? (json.places || []) : []);
            } catch {
                // An aborted or failed lookup means no menu, not an error
                // thrown into the middle of someone's typing.
                if (latest.current === text) setResults([]);
            } finally {
                if (latest.current === text) setBusy(false);
            }
        }, DEBOUNCE);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query, city]);

    return { results, busy };
};

export default usePlaceSearch;
