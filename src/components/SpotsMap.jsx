import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { GoogleMap, MarkerF, InfoWindowF, useJsApiLoader } from '@react-google-maps/api';
import { useTheme } from '../contexts/ThemeContext';
import { buildMapStyle, currentPalette, pinColours } from '../utils/mapStyle';

/**
 * Saved places on a map.
 *
 * Uses the same loader id and libraries as the day planner deliberately:
 * @react-google-maps throws if two useJsApiLoader calls disagree about their
 * options, and both live inside the Daydream.
 */

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const libraries = ['places'];

const pin = (colour, done, outline) => ({
    path: 'M 0,0 C -2,-8 -8,-10 -8,-16 a 8,8 0 1,1 16,0 c 0,6 -6,8 -8,16 z',
    fillColor: colour,
    fillOpacity: done ? 0.45 : 0.95,
    strokeColor: outline,
    strokeWeight: 1.5,
    scale: 1.4,
    anchor: { x: 0, y: 0 },
});

const SpotsMap = ({ spots = [], height = '28rem', onSelect, focus = null }) => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey,
        libraries,
    });
    const { themeId } = useTheme();
    const [open, setOpen] = useState(null);
    const [map, setMap] = useState(null);

    // Recomputed when the theme changes: the variables are read off the live
    // document, so this has to run after the new palette is applied.
    const [style, setStyle] = useState(() => ({ styles: [], colours: {}, ground: '#201620' }));
    useEffect(() => {
        const palette = currentPalette();
        setStyle({
            styles: buildMapStyle(palette),
            colours: pinColours(),
            ground: palette.ground,
        });
    }, [themeId]);

    const located = useMemo(
        () => spots.filter((s) => s.lat != null && s.lng != null),
        [spots]
    );

    // Fit to whatever is on screen rather than guessing a zoom: one spot in
    // Napa and one in SF need a very different view from three in one street.
    const onLoad = useCallback((instance) => {
        setMap(instance);
        if (!located.length || !window.google) return;
        if (located.length === 1) {
            instance.setCenter({ lat: located[0].lat, lng: located[0].lng });
            instance.setZoom(14);
            return;
        }
        const bounds = new window.google.maps.LatLngBounds();
        located.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
        instance.fitBounds(bounds, 48);
    }, [located]);

    // Re-fit when the set changes — filtering to "Napa" should move the map.
    React.useEffect(() => {
        if (!map || !located.length || !window.google) return;
        if (focus && focus.lat != null) {
            map.setCenter({ lat: focus.lat, lng: focus.lng });
            map.setZoom(focus.radiusKm && focus.radiusKm > 20 ? 10 : 13);
            return;
        }
        const bounds = new window.google.maps.LatLngBounds();
        located.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
        map.fitBounds(bounds, 48);
    }, [map, located, focus]);

    if (!googleMapsApiKey) {
        return <p className="muted">Add VITE_GOOGLE_MAPS_API_KEY to show the map.</p>;
    }
    if (!isLoaded) return <p className="muted">Unfolding the map…</p>;

    if (!located.length) {
        return (
            <p className="muted">
                None of these have coordinates yet, so there is nothing to pin.
            </p>
        );
    }

    return (
        <div className="spots-map" style={{ height }}>
            <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                onLoad={onLoad}
                options={{
                    styles: style.styles,
                    disableDefaultUI: true,
                    zoomControl: true,
                    gestureHandling: 'greedy',
                    backgroundColor: style.ground,
                }}
            >
                {located.map((spot) => (
                    <MarkerF
                        key={spot.id}
                        position={{ lat: spot.lat, lng: spot.lng }}
                        title={spot.name}
                        icon={pin(
                            style.colours[spot.category] || style.colours.cafe,
                            spot.status === 'been',
                            style.ground
                        )}
                        onClick={() => setOpen(spot)}
                    />
                ))}

                {open && (
                    <InfoWindowF
                        position={{ lat: open.lat, lng: open.lng }}
                        onCloseClick={() => setOpen(null)}
                    >
                        <div className="spots-map__card">
                            <strong>{open.name}</strong>
                            {open.neighborhood || open.city ? (
                                <div>{[open.neighborhood, open.city].filter(Boolean).join(', ')}</div>
                            ) : null}
                            {open.rating ? <div>★ {Number(open.rating).toFixed(1)}</div> : null}
                            {onSelect && (
                                <button type="button" onClick={() => onSelect(open)}>
                                    Add to a day
                                </button>
                            )}
                            {open.maps_url && (
                                <a href={open.maps_url} target="_blank" rel="noopener noreferrer">
                                    Open in Maps
                                </a>
                            )}
                        </div>
                    </InfoWindowF>
                )}
            </GoogleMap>

            {located.length < spots.length && (
                <p className="spots-map__note muted">
                    {spots.length - located.length} without coordinates, not shown.
                </p>
            )}
        </div>
    );
};

export default SpotsMap;
