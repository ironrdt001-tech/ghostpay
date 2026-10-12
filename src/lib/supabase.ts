import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export function formatHandle(value: string) {
  return `@${value.replace(/^@+/, '')}`
}

export function friendlyError(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
