import { generateGoogleCalendarUrl, generateICS } from './src/utils/calendarUtils.js';

// Mock Data
const plan = {
    title: "Test Trip",
    location: "Paris",
    planned_date: "2023-11-15"
};

const items = [
    {
        id: 1,
        activity: "Visit Eiffel Tower",
        start_time: "10:00:00",
        duration: "02:00:00",
        notes: "Don't forget camera",
        location: "Champ de Mars",
        is_brainstorm: false
    },
    {
        id: 2,
        activity: "Lunch at Cafe",
        start_time: "12:30:00",
        is_brainstorm: false // Should default to 1 hour
    }
];

// Test GCal URL
console.log("--- Google Calendar URL ---");
const url = generateGoogleCalendarUrl(items[0], plan.planned_date);
console.log(url);

// Test ICS Generation
console.log("\n--- ICS Content ---");
const ics = generateICS(plan, items);
console.log(ics);
