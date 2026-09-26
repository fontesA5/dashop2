/**
 * Supabase Client Configuration
 * 
 * This file initializes the Supabase client with environment variables.
 * In production, these come from wrangler.toml or a deployed .env file.
 */

// Load environment variables (works in browser with proper setup)
// For local development with Cloudflare Workers, use:
const supabaseUrl = 'https://wninmlukmkdlrfgblobz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduaW5tbHVrbWtkbHJmZ2Jsb2J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNjgxOTAsImV4cCI6MjEwNTk0NDE5MH0.QahkI2kesSvnoehhwNHMLXRehqI1wCbJMztaW3_E6wg'

// Alternative: Read from global env (for direct .env file usage)
// const supabaseUrl = process.env.SUPABASE_URL || ''
// const supabaseKey = process.env.SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Supabase not configured. Using demo mode.');
    console.log('To configure:');
    console.log('1. Create a Supabase project at https://app.supabase.com');
    console.log('2. Get your URL and anon key from Settings > API');
    console.log('3. Update .env file with these values');
}

let supabaseClient;

try {
    if (supabaseUrl && supabaseKey) {
        supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        console.log('✅ Supabase client initialized');
    }
} catch (error) {
    console.error('❌ Error initializing Supabase:', error);
}

// Export for use in app.js
window.supabaseClient = supabaseClient;
window.supabaseUrl = supabaseUrl;
window.supabaseAnonKey = supabaseKey;
