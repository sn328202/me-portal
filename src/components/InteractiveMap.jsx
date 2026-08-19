import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet marker icons not showing in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Sub-component to handle map clicks
const MapEvents = ({ onMapClick }) => {
    useMapEvents({
        click(e) {
            onMapClick && onMapClick(e.latlng);
        },
    });
    return null;
};

const InteractiveMap = ({ trips, onLocationSelect, selectedLocation, isEditing }) => {
    // Default center (Atlantic Ocean view)
    const position = [35.0, -40.0];

    return (
        <div className="interactive-map">
            <MapContainer center={position} zoom={2} className="interactive-map__canvas">
                {/* CartoDB Dark Matter Tiles (Victorian/Dark theme appropriate) */}
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                {/* Plot existing trips */}
                {trips.map(trip => (
                    <React.Fragment key={trip.id}>
                        {/* Legacy Support: Single Coordinate */}
                        {trip.coordinates && !trip.waypoints && (
                            <Marker position={trip.coordinates}>
                                <Popup>
                                    <div className="map-popup">
                                        <strong>{trip.destination}</strong><br />
                                        {trip.status}
                                    </div>
                                </Popup>
                            </Marker>
                        )}

                        {trip.waypoints && trip.waypoints.map((wp, idx) => (
                            <Marker key={`${trip.id}-wp-${idx}`} position={wp.coordinates || [wp.lat, wp.lng]}>
                                <Popup>
                                    <div className="map-popup">
                                        <strong>{wp.name || trip.destination}</strong><br />
                                        <span className="map-popup__sub">{trip.destination} stop #{idx + 1}</span>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </React.Fragment>
                ))}

                {/* Show temporary marker when setting location */}
                {selectedLocation && (
                    <Marker position={selectedLocation} opacity={0.6}>
                        <Popup>New Waypoint</Popup>
                    </Marker>
                )}

                {isEditing && <MapEvents onMapClick={onLocationSelect} />}
            </MapContainer>
        </div>
    );
};

export default InteractiveMap;
