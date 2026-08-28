import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { luminance } from '../utils/wardrobeTheme';

/**
 * The map, showing where you are actually going.
 *
 * The old one opened on the Atlantic at zoom 2 every time, whatever was on it,
 * and plotted only waypoints clicked on by hand — so a fifteen-day trip across
 * India was a world map with three pins the size of a full stop somewhere near
 * the right-hand edge. It was not a map of the trip; it was a map, with the
 * trip on it.
 *
 * Three changes make it a map of the trip: it fits itself to whatever it is
 * showing, it plots the *legs* in order with a line between them, and it takes
 * its tiles and its pins from the theme rather than being permanently dark.
 *
 * And when there is nothing to show it renders nothing at all. An empty world
 * map is worse than no map — it takes the same space and answers nothing.
 */

const read = (name) => (typeof document === 'undefined'
    ? ''
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim());

/**
 * A pin drawn from the theme's own accent, with its number in it.
 *
 * Leaflet's default blue teardrop belongs to no theme here, and the order of
 * the stops is half of what the map is saying.
 */
const pin = (label, { accent, ink, muted }) => L.divIcon({
    className: 'trip-pin',
    html: `<span class="trip-pin__dot" style="background:${accent};color:${ink};border-color:${muted}">${label}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
});

/** Fit the view to everything on it, rather than opening on the Atlantic. */
const FitTo = ({ points }) => {
    const map = useMap();

    useEffect(() => {
        if (!points.length) return;
        if (points.length === 1) {
            // A single point has no extent, and fitBounds on it zooms to the
            // maximum — a street view of a city you have not been to yet.
            map.setView(points[0], 9);
            return;
        }
        map.fitBounds(L.latLngBounds(points), { padding: [42, 42], maxZoom: 11 });
    }, [map, points]);

    return null;
};

const MapEvents = ({ onMapClick }) => {
    useMapEvents({ click: (e) => onMapClick?.(e.latlng) });
    return null;
};

const valid = (lat, lng) => (
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    // 0,0 is in the Atlantic and is what an unset pair of coordinates looks like.
    && !(Number(lat) === 0 && Number(lng) === 0)
);

/**
 * `stops` are the places, in order: { lat, lng, label, sub, badge, onOpen }.
 * `route` draws a line through them, which suits one trip and not an index of
 * several unrelated ones.
 */
const InteractiveMap = ({
    stops = [], route = false, onLocationSelect, selectedLocation, isEditing,
}) => {
    const plotted = useMemo(() => stops.filter((s) => valid(s.lat, s.lng)), [stops]);
    const points = useMemo(
        () => plotted.map((s) => [Number(s.lat), Number(s.lng)]),
        [plotted]
    );

    const theme = useMemo(() => {
        const bg = read('--bg-main');
        return {
            dark: (luminance(bg) ?? 1) < 0.4,
            accent: read('--text-gold') || '#9b6a4f',
            ink: read('--bg-panel') || '#fff',
            muted: read('--border-dim') || '#ccc',
        };
    }, []);

    // Nothing to show, nothing to draw. The one case where the honest thing is
    // to take the space back.
    if (!plotted.length && !isEditing) return null;

    return (
        <div className="interactive-map">
            <MapContainer
                center={points[0] || [20, 0]}
                zoom={points.length ? 6 : 2}
                scrollWheelZoom={false}
                className="interactive-map__canvas"
            >
                {/* Light tiles under a light theme. The map was the one part of
                    the app that stayed dark whatever the vibe. */}
                <TileLayer
                    key={theme.dark ? 'dark' : 'light'}
                    url={theme.dark
                        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'}
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                <FitTo points={points} />

                {route && points.length > 1 && (
                    <Polyline
                        positions={points}
                        pathOptions={{ color: theme.accent, weight: 2, opacity: 0.7, dashArray: '5 7' }}
                    />
                )}

                {plotted.map((stop, i) => (
                    <Marker
                        key={stop.key || `${stop.lat},${stop.lng},${i}`}
                        position={[Number(stop.lat), Number(stop.lng)]}
                        icon={pin(route ? String(i + 1) : (stop.badge || '•'), theme)}
                        eventHandlers={stop.onOpen ? { click: stop.onOpen } : undefined}
                    >
                        <Popup>
                            <div className="map-popup">
                                <strong>{stop.label}</strong>
                                {stop.sub && <><br /><span className="map-popup__sub">{stop.sub}</span></>}
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {selectedLocation && (
                    <Marker position={selectedLocation} opacity={0.6}>
                        <Popup>New waypoint</Popup>
                    </Marker>
                )}

                {isEditing && <MapEvents onMapClick={onLocationSelect} />}
            </MapContainer>
        </div>
    );
};

export default InteractiveMap;
