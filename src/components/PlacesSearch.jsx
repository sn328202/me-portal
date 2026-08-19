import React from 'react';
import usePlacesAutocomplete, {
    getGeocode,
    getLatLng,
} from 'use-places-autocomplete';
import { GiPositionMarker } from 'react-icons/gi';

/**
 * Google Places autocomplete. Used only by The Daydream, so its styling
 * lives in styles/DayPlanner.css. `id` is forwarded to the input so a
 * <Field> label can point at it.
 */
const PlacesSearch = ({ onSelect, placeholder = 'Search for locations...', id, className = '', ...rest }) => {
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
            console.error('Error: ', error);
        }
    };

    return (
        <div className="places-search">
            <input
                id={id}
                className={['input', className].filter(Boolean).join(' ')}
                value={value}
                onChange={handleInput}
                disabled={!ready}
                placeholder={placeholder}
                {...rest}
            />

            {status === 'OK' && (
                <ul className="places-search__list">
                    {data.map((suggestion) => {
                        const {
                            place_id,
                            structured_formatting: { main_text, secondary_text },
                        } = suggestion;

                        return (
                            <li key={place_id}>
                                <button
                                    type="button"
                                    className="places-search__option"
                                    onClick={() => handleSelect(suggestion)}
                                >
                                    <GiPositionMarker />
                                    <span>
                                        <strong>{main_text}</strong>
                                        <span className="places-search__secondary">{secondary_text}</span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default PlacesSearch;
