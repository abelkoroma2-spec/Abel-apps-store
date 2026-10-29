import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadEnv } from 'vite'

const siteUrl = 'https://abel-apps-store.vercel.app'
const outputPath = resolve('dist/sitemap.xml')
const env = loadEnv('production', process.cwd(), '')
const sitemapUrls = [`${siteUrl}/`]
const supabaseUrl = (env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')
const supabaseAnonKey = (env.VITE_SUPABASE_ANON_KEY || '').trim()

if (supabaseUrl && supabaseAnonKey) {
  const endpoint = new URL(`${supabaseUrl}/rest/v1/apps`)
  endpoint.search = new URLSearchParams({
    select: 'slug',
    published: 'eq.true',
    order: 'created_at.desc',
  }).toString()

  try {
    const response = await fetch(endpoint, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    })
    if (!response.ok) throw new Error(`Supabase returned HTTP ${response.status}`)
    const items = await response.json()
    for (const item of items) {
      if (typeof item.slug === 'string' && item.slug.length > 0) {
        sitemapUrls.push(`${siteUrl}/app/${encodeURIComponent(item.slug)}`)
      }
    }
  } catch (error) {
    console.warn(`Could not add catalog pages to the sitemap: ${error.message}`)
  }
} else {
  console.warn('Supabase URL or anon key is not configured; sitemap includes only the home page.')
}

const urls = sitemapUrls.map(url => `  <url><loc>${url}</loc></url>`).join('\n')
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
await writeFile(outputPath, sitemap)
console.log(`Generated sitemap with ${sitemapUrls.length} URL(s).`)
