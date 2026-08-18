import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xtykaafmrncqrizdwqrm.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0eWthYWZtcm5jcXJpemR3cXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDcwNDMsImV4cCI6MjA4NTEyMzA0M30.Z7vQsRpVGjVIYw9JkWceFJ7Ti8Fa0RodDjJZKfAkQUc'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testLogin() {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'neha.sule@hotmail.com',
        password: 'pandarox',
    })

    if (error) {
        console.error('Login Error:', error.message)
        console.error('Full Error:', JSON.stringify(error, null, 2))
    } else {
        console.log('Login Success! User ID:', data.user.id)
    }
}

testLogin()
