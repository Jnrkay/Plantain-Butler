// Public Supabase settings. Both values are designed to ship inside the app:
// the anon key only grants what the database's row-level-security rules allow
// (see supabase/schema.sql), and every table is locked to the signed-in household.
// Environment variables override these, e.g. for a separate test project.
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {}

export const SUPABASE_URL =
  env.VITE_SUPABASE_URL || 'https://gniwixedchtwrqqvivjj.supabase.co'

export const SUPABASE_ANON_KEY =
  env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduaXdpeGVkY2h0d3JxcXZpdmpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwOTU3NzIsImV4cCI6MjEwNzY3MTc3Mn0.grH016-1a3XxkHQ0S1PkuDXwiGSXrZeryTpp4uQzBhE'
