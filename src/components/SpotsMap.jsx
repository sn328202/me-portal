import React, { useMemo, useState, useCallback } from 'react';
import { GoogleMap, MarkerF, InfoWindowF, useJsApiLoader } from '@react-google-maps/api';

/**
 * Saved places on a map.
 *
 * Uses the same loader id and libraries as the day planner deliberately:
 * @react-google-maps throws if two useJsApiLoader calls disagree about their
 * options, and both live inside the Daydream.
 */

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const libraries = ['places'];

/* Google's default map is a bright road atlas that fights every theme in this
   app. These styles mute it to something the portal's palette can sit on. */
const MUTED = [
    { elementType: 'geometry', stylers: [{ color: '#241c24' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#241c24' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#b6a08f' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#33262f' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8d7276' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1a1220' }] },
    { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#2a2130' }] },
];

const COLOURS = {
    restaurant: '#dc8b95',
    bar: '#b07c69',
    cafe: '#d9a37c',
    museum: '#9d8ec4',
    park: '#7ba37b',
    hike: '#7ba37b',
    shop: '#d4a5c4',
    venue: '#c4a05a',
};

const pin = (colour, done) => ({
    path: 'M 0,0 C -2,-8 -8,-10 -8,-16 a 8,8 0 1,1 16,0 c 0,6 -6,8 -8,16 z',
    fillColor: colour,
    fillOpacity: done ? 0.45 : 0.95,
    strokeColor: '#201620',
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
    const [open, setOpen] = useState(null);
    const [map, setMap] = useState(null);

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
                    styles: MUTED,
                    disableDefaultUI: true,
                    zoomControl: true,
                    gestureHandling: 'greedy',
                    backgroundColor: '#201620',
                }}
            >
                {located.map((spot) => (
                    <MarkerF
                        key={spot.id}
                        position={{ lat: spot.lat, lng: spot.lng }}
                        title={spot.name}
                        icon={pin(COLOURS[spot.category] || '#d9a37c', spot.status === 'been')}
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
