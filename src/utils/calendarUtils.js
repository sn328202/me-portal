
import { format, addHours, parse } from 'date-fns';

/**
 * Generates a Google Calendar URL for a single event
 * @param {Object} item - The itinerary item
 * @param {string} date - The date of the plan (YYYY-MM-DD)
 * @returns {string} - The Google Calendar URL
 */
export const generateGoogleCalendarUrl = (item, date) => {
    if (!item || !date) return '#';

    const title = encodeURIComponent(item.activity);
    const location = encodeURIComponent(item.location || '');
    const details = encodeURIComponent(`From the Atlas: ${item.notes || ''}\n${item.link || ''}`);

    let startTime, endTime;

    try {
        // Parse start time
        const startDateTime = parse(`${date} ${item.start_time}`, 'yyyy-MM-dd HH:mm:ss', new Date());
        startTime = format(startDateTime, "yyyyMMdd'T'HHmmss");

        // Calculate end time (default to 1 hour if duration not set)
        // Duration format expected: "HH:mm:ss" or null
        let endDateTime;
        if (item.duration) {
            const [hours, minutes] = item.duration.split(':').map(Number);
            endDateTime = startDateTime; // clone? no, addHours is immutable
            endDateTime = new Date(startDateTime.getTime() + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000));
        } else {
            endDateTime = addHours(startDateTime, 1);
        }
        endTime = format(endDateTime, "yyyyMMdd'T'HHmmss");

    } catch (e) {
        console.error("Error parsing dates for calendar", e);
        return '#';
    }

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${startTime}/${endTime}`;
};

/**
 * Generates .ics file content for the entire itinerary
 * @param {Object} plan - The plan object { title, location, planned_date }
 * @param {Array} items - Array of plan items
 * @returns {string} - The .ics file content
 */
export const generateICS = (plan, items) => {
    if (!plan || !items || items.length === 0) return '';

    const scheduledItems = items.filter(i => !i.is_brainstorm && i.start_time);
    if (scheduledItems.length === 0) return '';

    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Atlas//MePortal//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH' // Useful for importing as a separate calendar
    ];

    const now = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");

    scheduledItems.forEach(item => {
        try {
            const startDateTime = parse(`${plan.planned_date} ${item.start_time}`, 'yyyy-MM-dd HH:mm:ss', new Date());

            // Calculate end time
            let endDateTime;
            if (item.duration) {
                const [hours, minutes] = item.duration.split(':').map(Number);
                endDateTime = new Date(startDateTime.getTime() + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000));
            } else {
                endDateTime = addHours(startDateTime, 1);
            }

            const dtStart = format(startDateTime, "yyyyMMdd'T'HHmmss");
            const dtEnd = format(endDateTime, "yyyyMMdd'T'HHmmss");
            const title = item.activity; // Escape special chars?
            const description = `From the Atlas: ${item.notes || ''}\\n${item.link || ''}`;
            const location = item.location || '';
            const uid = `${item.id}@atlas.me`;

            icsContent.push('BEGIN:VEVENT');
            icsContent.push(`UID:${uid}`);
            icsContent.push(`DTSTAMP:${now}`);
            icsContent.push(`DTSTART:${dtStart}`);
            icsContent.push(`DTEND:${dtEnd}`);
            icsContent.push(`SUMMARY:${title}`);
            icsContent.push(`DESCRIPTION:${description}`);
            icsContent.push(`LOCATION:${location}`);
            icsContent.push('STATUS:CONFIRMED');
            icsContent.push('END:VEVENT');

        } catch (e) {
            console.error("Skipping malformed item for ICS", item);
        }
    });

    icsContent.push('END:VCALENDAR');
    return icsContent.join('\r\n'); // proper line endings
};

/**
 * Triggers a download of the .ics file
 * @param {string} filename 
 * @param {string} content 
 */
export const downloadICS = (filename, content) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/calendar' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
    document.body.removeChild(element);
};
