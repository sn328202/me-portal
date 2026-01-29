import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xtykaafmrncqrizdwqrm.supabase.co'
const supabaseKey = 'sb_publishable_fqqhvYvpQvo4syIXHi-7WA_KsrH6lE0'
const supabase = createClient(supabaseUrl, supabaseKey)

const main = async () => {
    const { data, error } = await supabase
        .from('atlas_trips')
        .select('*')

    if (error) {
        console.error('Error:', error)
    } else {
        console.log('Total trips:', data.length)
        console.log('Trips:', JSON.stringify(data, null, 2))

        const nextTrip = data
            .filter(t => t.start_date && new Date(t.start_date) > new Date())
            .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0];

        if (nextTrip) {
            console.log('Next Trip Identified:', nextTrip.destination)
        } else {
            console.log('No qualifying Next Trip found.')
        }
    }
}

main()
