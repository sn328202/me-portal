import React from 'react';
import usePlacesAutocomplete, {
    getGeocode,
    getLatLng,
} from 'use-places-autocomplete';
import { GiPositionMarker } from 'react-icons/gi';

const PlacesSearch = ({ onSelect, placeholder = "Search for locations...", style = {} }) => {
    const {
        ready,
        value,
        suggestions: { status, data },
        setValue,
        clearSuggestions,
    } = usePlacesAutocomplete({
        requestOptions: {
            /* Define search scope here */
        },
        debounce: 300,
    });

    const handleInput = (e) => {
        setValue(e.target.value);
    };

    const handleSelect = async ({ description, place_id }) => {
        // When user selects a place, we can extract the coordinates
        // and store the result.
        setValue(description, false);
        clearSuggestions();

        try {
            const results = await getGeocode({ address: description });
            const { lat, lng } = await getLatLng(results[0]);

            const link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(description)}&query_place_id=${place_id}`;

            onSelect({
                location: description.split(',')[0], // Simple name
                address: description,
                lat,
                lng,
                link,
                place_id
            });
        } catch (error) {
            console.error("Error: ", error);
        }
    };

    return (
        <div style={{ position: 'relative', width: '100%', ...style }}>
            <input
                value={value}
                onChange={handleInput}
                disabled={!ready}
                placeholder={placeholder}
                style={{
                    width: '100%',
                    padding: '8px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-dim)',
                    color: 'var(--text-main)',
                    fontFamily: 'inherit',
                    ...style
                }}
            />

            {status === "OK" && (
                <ul style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-dim)',
                    zIndex: 1000,
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}>
                    {data.map((suggestion) => {
                        const {
                            place_id,
                            structured_formatting: { main_text, secondary_text },
                        } = suggestion;

                        return (
                            <li
                                key={place_id}
                                onClick={() => handleSelect(suggestion)}
                                style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid var(--border-dim)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-gold-dim)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <GiPositionMarker style={{ opacity: 0.5 }} />
                                <div>
                                    <strong>{main_text}</strong>
                                    <span style={{ fontSize: '0.8rem', opacity: 0.7, marginLeft: '6px' }}>{secondary_text}</span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default PlacesSearch;
