
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xtykaafmrncqrizdwqrm.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0eWthYWZtcm5jcXJpemR3cXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDcwNDMsImV4cCI6MjA4NTEyMzA0M30.Z7vQsRpVGjVIYw9JkWceFJ7Ti8Fa0RodDjJZKfAkQUc'
const supabase = createClient(supabaseUrl, supabaseKey)

console.log('Testing Supabase connection...')

const start = Date.now();
supabase.from('atlas_trips').select('*').limit(1)
    .then(({ data, error }) => {
        const duration = (Date.now() - start) / 1000;
        if (error) {
            console.error(`Error after ${duration}s:`, error)
        } else {
            console.log(`Success after ${duration}s! Found ${data.length} trips.`);
        }
    })
    .catch(err => {
        console.error('Fatal Error:', err)
    });

setTimeout(() => {
    console.log('Test still running after 15s... probably a timeout.');
}, 15000);
