import { useJsApiLoader } from '@react-google-maps/api';

/**
 * The Google Maps script, loaded once for whoever asks.
 *
 * It used to be loaded in exactly one place — the Day Builder — and every
 * other page that wanted to search for a place quietly did not work. The
 * console said so ("Google Maps Places API library must be loaded") and
 * nothing on screen did: the box appeared, you typed, and no suggestions ever
 * came. That is the worst kind of broken, because it looks like the search
 * found nothing rather than like the search never ran.
 *
 * So the knowledge of how to load it lives here, in one place, and the
 * components that need a place search ask for it themselves rather than
 * relying on whichever page happens to contain them having remembered.
 *
 * `useJsApiLoader` keys on the id, so several callers asking at once share a
 * single <script>. They must ask with the *same* options — hence the
 * module-level constants; a fresh array literal on every render is what makes
 * this library complain about being reloaded with different libraries.
 */

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const LIBRARIES = ['places'];

export const useMapsReady = () => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey,
        libraries: LIBRARIES,
    });
    return isLoaded;
};

export default useMapsReady;
