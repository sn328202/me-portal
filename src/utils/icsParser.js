export const parseICS = (icsData) => {
    const events = [];
    const lines = icsData.split(/\r\n|\n|\r/);

    let inEvent = false;
    let currentEvent = {};

    for (const line of lines) {
        if (line.startsWith('BEGIN:VEVENT')) {
            inEvent = true;
            currentEvent = {};
        } else if (line.startsWith('END:VEVENT')) {
            inEvent = false;
            if (currentEvent.dtstart && currentEvent.summary) {
                // Formatting Check: convert ICS date (YYYYMMDDTHHMMSSZ) to YYYY-MM-DD
                const dateStr = currentEvent.dtstart;
                let formattedDate = '';
                let formattedTime = '';

                // Handle YYYYMMDD
                if (dateStr.length >= 8) {
                    formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                }

                // Handle Time if Present (T HH MM SS)
                if (dateStr.includes('T')) {
                    const timePart = dateStr.split('T')[1];
                    if (timePart.length >= 4) {
                        const hour = parseInt(timePart.substring(0, 2));
                        const min = timePart.substring(2, 4);
                        const ampm = hour >= 12 ? 'PM' : 'AM';
                        const displayHour = hour % 12 || 12;
                        formattedTime = `${displayHour}:${min} ${ampm}`;
                    }
                }

                events.push({
                    id: `remote-${events.length}`,
                    date: formattedDate,
                    title: currentEvent.summary,
                    time: formattedTime,
                    isRemote: true
                });
            }
        } else if (inEvent) {
            // Simple Line Parsing
            if (line.startsWith('SUMMARY:')) {
                currentEvent.summary = line.substring(8);
            } else if (line.startsWith('DTSTART')) {
                // DTSTART;VALUE=DATE:20230101 or DTSTART:20230101T100000Z
                const parts = line.split(':');
                if (parts.length > 1) {
                    currentEvent.dtstart = parts[1];
                }
            }
        }
    }

    return events;
};
