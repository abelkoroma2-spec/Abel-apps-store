import { createClient } from '@supabase/supabase-js'

const normalizeSupabaseUrl = (value?: string) => {
  const cleaned = (value ?? '').trim().replace(/\/+$/, '')
  return cleaned.replace(/\/rest\/v1$/, '')
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL) || 'https://qgsmhhneeqtqzluxxogw.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnc21oaG5lZXF0cXpsdXh4b2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjk1NTYsImV4cCI6MjEwNzg0NTU1Nn0.PnuHGRiBjQzn-Swfgv66JRG_RjBgpmedJLsRPkh87Cs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const CATEGORIES = ['Education', 'Games', 'Music', 'Business', 'Tools']
export type Version = { id: string; version: string; apk_path: string; size_bytes: number; notes: string; released_at: string }
export type Item = { id: string; slug: string; name: string; short_desc: string; description: string; features: string[]; category: string
  icon_url: string | null; screenshots: string[]; min_android: string; featured: boolean; published: boolean; downloads: number; created_at: string; versions: Version[] }
export const fmt = (b: number) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.ceil(b / 1024) + ' KB')
export const latest = (a: Item) => [...(a.versions ?? [])].sort((x, y) => +new Date(y.released_at) - +new Date(x.released_at))[0]
export const apkUrl = (p: string) => supabase.storage.from('apks').getPublicUrl(p).data.publicUrl
export const imgUrl = (p: string) => supabase.storage.from('images').getPublicUrl(p).data.publicUrl
export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const fetchApps = async () => {
  const { data, error } = await supabase.from('apps').select('*, versions(*)').order('created_at', { ascending: false })
  if (error) throw error
  return data as Item[]
}
