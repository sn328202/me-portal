import React, { useState } from 'react';
import { GiPositionMarker } from 'react-icons/gi';
import PlacesSearch from './PlacesSearch';
import { useMapsReady } from '../hooks/useMapsReady';
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
/**
 * The search box, mounted only once she has asked for it.
 *
 * The Maps script is loaded from in here rather than by the page, so that no
 * page can forget — and mounting this only on the click means the script is
 * not fetched by every trip page on the off-chance somebody wants to look a
 * place up. It says so while it loads, because a search box that silently
 * finds nothing looks like an answer.
 */
const Picker = ({ label, className, onPick, onCancel }) => {
    const loaded = useMapsReady();

    return (
        <p className={`placefield placefield--searching ${className}`}>
            <GiPositionMarker aria-hidden="true" />
            {loaded ? (
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
                            // Carried through for the callers that draw pins.
                            // A stop does not need a coordinate; a leg of the
                            // route is a dot on the map and does.
                            lat: place.lat ?? null,
                            lng: place.lng ?? null,
                            // And for the ones that want to know which city
                            // they have just been told about.
                            city: place.city || '',
                        });
                        onCancel();
                    }}
                />
            ) : (
                <span className="placefield__loading">Loading the map…</span>
            )}
            <button type="button" className="placefield__act" onClick={onCancel}>
                cancel
            </button>
        </p>
    );
};

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
            <Picker
                label={label}
                className={className}
                onPick={onPick}
                onCancel={() => setSearching(false)}
            />
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
