import React from 'react';
import { Link } from 'react-router-dom';
import { GiCoins } from 'react-icons/gi';
import { Button, ConfirmButton, Field, Modal } from './ui';
import SmartTimeInput from './SmartTimeInput';
import DurationPicker from './DurationPicker';
import ActivityFace from './ActivityFace';
import MentionInput from './MentionInput';
import PlaceField from './PlaceField';
import BookedChip from './BookedChip';
import { moveStart, setLength, lengthOfRow, setCost, headingFor } from '../utils/stopEdit';
import { showCost } from '../utils/dayBuild';
import '../styles/StopPopover.css';

/**
 * One stop, edited where you found it.
 *
 * Clicking a block on the timeline and being taken to another page is the
 * wrong trade for changing a price or nudging an hour: the whole reason you
 * clicked it is that you could see it in context, and the context is what
 * navigating away costs you.
 *
 * So there are two sizes of editing, matched to two sizes of job. This is the
 * small one — a name, a time, a length, a price, a note. Working on the whole
 * day is a different job and gets its own page, linked from the bottom of
 * this, so there is always a door to the larger surface rather than a ceiling.
 *
 * It writes straight through. There is no Save: every field commits on blur
 * to the same `updateItem` the rest of the Atlas uses, which is one less
 * thing to have got wrong and one less thing to remember to press.
 */
const StopPopover = ({ item, dayId, date, tripId, near = null, onChange, onDelete, onClose }) => {
    if (!item) return null;

    const patch = (p) => onChange?.(dayId, item.id, p);

    return (
        <Modal open onClose={onClose} title={headingFor(item)}>
            <div className="stop-pop">
                <div className="stop-pop__top">
                    <ActivityFace
                        item={item}
                        className="stop-pop__face"
                        onChange={(icon) => patch({ icon })}
                    />

                    <Field label="What is it">
                        <MentionInput
                            value={item.title || ''}
                            near={near}
                            onChange={(title) => patch({ title })}
                            onPick={(place, title) => patch({
                                title,
                                location: place.address || item.location,
                                link: place.maps_url || item.link,
                                place_id: place.place_id || item.place_id,
                            })}
                        />
                    </Field>
                </div>

                <div className="stop-pop__row">
                    <Field label="Starts">
                        <SmartTimeInput
                            label="Start time"
                            value={item.start_time ? item.start_time.substring(0, 5) : ''}
                            /* The length goes with it. Leaving the end where
                               it was does not move the block, it stretches
                               it. */
                            onChange={(v) => patch(moveStart(item, v ? `${v}:00` : ''))}
                        />
                    </Field>

                    <Field label="Runs for">
                        <DurationPicker
                            value={lengthOfRow(item)}
                            label={item.title}
                            onChange={(duration) => patch(setLength(item, duration))}
                        />
                    </Field>
                </div>

                <div className="stop-pop__row">
                    <Field label="Cost">
                        <span className="stop-pop__cost">
                            <GiCoins aria-hidden="true" />
                            <input
                                key={`sc-${item.id}`}
                                className="input"
                                inputMode="decimal"
                                placeholder="cost"
                                aria-label="Cost"
                                defaultValue={showCost(item.cost)}
                                onBlur={(e) => {
                                    const v = e.target.value.trim();
                                    if (v !== showCost(item.cost)) patch(setCost(v));
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                            />
                            <button
                                type="button"
                                className={`tl-item__share${item.cost_shared === false ? '' : ' is-split'}`}
                                title={item.cost_shared === false ? 'Each person pays this' : 'Split across the party'}
                                onClick={() => patch({ cost_shared: item.cost_shared === false })}
                            >
                                {item.cost_shared === false ? 'each' : 'split'}
                            </button>
                        </span>
                    </Field>

                    <Field label="Booking">
                        <BookedChip
                            stop={item}
                            label={item.title}
                            onChange={(booking) => patch({ booking })}
                        />
                    </Field>
                </div>

                <Field label="Where">
                    {/* A real place, not a typed string: the map link is what
                        makes the drive times work and what the share sheet
                        hands to whoever you send it to. */}
                    <PlaceField
                        location={item.location}
                        link={item.link}
                        label={item.title || 'this stop'}
                        onPick={(p) => patch(p)}
                        onClear={item.location
                            ? () => patch({ location: null, link: null, place_id: null })
                            : undefined}
                    />
                </Field>

                <Field label="Notes">
                    <textarea
                        key={`sn-${item.id}`}
                        className="input stop-pop__note"
                        rows={3}
                        placeholder="Anything worth remembering…"
                        defaultValue={item.notes || ''}
                        onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (item.notes || '')) patch({ notes: v || null });
                        }}
                    />
                </Field>

                <footer className="stop-pop__foot">
                    {/* A door to the bigger surface, not a ceiling. */}
                    {tripId && date && (
                        <Link className="stop-pop__more" to={`/atlas/${tripId}/day/${String(date).slice(0, 10)}`}>
                            Open the whole day →
                        </Link>
                    )}
                    <ConfirmButton
                        label="Delete this stop"
                        confirmLabel="Confirm?"
                        onConfirm={() => { onDelete?.(dayId, item.id); onClose?.(); }}
                    >
                        Delete
                    </ConfirmButton>
                    <Button variant="ghost" onClick={onClose}>Done</Button>
                </footer>
            </div>
        </Modal>
    );
};

export default StopPopover;
