/**
 * What it takes to put a held booking on a day.
 *
 * The day picker is the interesting part of "add this to a trip" — one match
 * settles itself, two trips covering the same date have to be asked about,
 * nothing near it is worth saying out loud — and none of that has anything to
 * do with whether the thing being placed is a table or a train. So it is
 * written once, and this is the short list of the four things it cannot know
 * on its own: which table to stamp, when the booking is, what to call it, and
 * how to turn it into a row of the day.
 *
 * Kept apart from the component so both specs can be tested without a browser
 * — the one that decides which day a 9pm departure belongs to is exactly the
 * function worth having a test for.
 */

import { localDate, asAtlasItem as itemFromBooking, bookingNote } from './reservationToDay.js';
import {
    localDate as journeyDate, asAtlasItem as itemFromJourney,
    journeyNote, titleOf as journeyTitle,
} from './journeys.js';

/** A table, a tasting, a show — anything in the Table Book. */
export const BOOKING = {
    table: 'reservations',
    noun: 'booking',
    dateOf: (r) => localDate(r?.starts_at),
    nameOf: (r) => r?.name || 'Reservation',
    noteOf: bookingNote,
    itemOf: itemFromBooking,
};

/** A flight, a train, a ferry — anything in the Ticket Book. */
export const JOURNEY = {
    table: 'journeys',
    noun: 'journey',
    dateOf: (j) => journeyDate(j?.depart_at),
    nameOf: journeyTitle,
    noteOf: journeyNote,
    itemOf: itemFromJourney,
};
