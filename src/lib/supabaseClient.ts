import { createClient } from '@supabase/supabase-js'

/**
 * Initializes the Supabase client for the application.
 * 
 * This client is used as a singleton throughout the app to interact with 
 * the Supabase database, authentication, and real-time subscriptions.
 * 
 * It relies on Vite environment variables:
 * - `VITE_SUPABASE_URL`: The unique URL of your Supabase project.
 * - `VITE_SUPABASE_PUBLISHABLE_KEY`: The public API key (safe for browser use).
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
)