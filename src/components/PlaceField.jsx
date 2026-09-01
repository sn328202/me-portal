import React, { useState } from 'react';
import { GiPositionMarker } from 'react-icons/gi';
import PlacesSearch from './PlacesSearch';
import '../styles/PlaceField.css';

/**
 * Where a thing is, addable after the fact.
 *
 * A card only got an address if she picked the place in the add form, at the
 * one moment she was typing its name. Anything typed straight onto the day —
 * or dragged off the board, or moved over from an itinerary — showed the
 * address it did not have, read-only, for ever. There was no way to say
 * "it's this one" later, so the drive times could not be worked out, the map
 * link was missing, and the share sheet had a stop with no address on it.
 *
 * So the line is a control. Empty, it offers to look the place up; filled, it
 * is the address with its map link and a way to change or forget it.
 */
const PlaceField = ({
    location,
    link,
    ready = true,
    label = 'this stop',
    className = '',
    onPick,
    onClear,
}) => {
    const [searching, setSearching] = useState(false);

    if (searching && ready) {
        return (
            <p className={`placefield placefield--searching ${className}`}>
                <GiPositionMarker aria-hidden="true" />
                <PlacesSearch
                    className="placefield__search"
                    placeholder="Search for the place…"
                    aria-label={`Find where ${label} is`}
                    autoFocus
                    onSelect={(place) => {
                        onPick?.({
                            location: place.address || place.location,
                            link: place.link || null,
                            place_id: place.place_id || null,
                        });
                        setSearching(false);
                    }}
                />
                <button
                    type="button"
                    className="placefield__act"
                    onClick={() => setSearching(false)}
                >
                    cancel
                </button>
            </p>
        );
    }

    if (!location) {
        return (
            <p className={`placefield placefield--empty ${className}`}>
                <button
                    type="button"
                    className="placefield__add"
                    onClick={() => setSearching(true)}
                    disabled={!ready}
                    title={ready ? undefined : 'The map is still loading'}
                >
                    <GiPositionMarker aria-hidden="true" /> Add a place
                </button>
            </p>
        );
    }

    return (
        <p className={`placefield ${className}`}>
            <GiPositionMarker aria-hidden="true" />
            {link ? (
                <a href={link} target="_blank" rel="noopener noreferrer">{location}</a>
            ) : (
                <span>{location}</span>
            )}
            {ready && (
                <button
                    type="button"
                    className="placefield__act"
                    onClick={() => setSearching(true)}
                    aria-label={`Change where ${label} is`}
                >
                    change
                </button>
            )}
            {onClear && (
                <button
                    type="button"
                    className="placefield__act"
                    onClick={onClear}
                    aria-label={`Forget where ${label} is`}
                >
                    ×
                </button>
            )}
        </p>
    );
};

export default PlaceField;
