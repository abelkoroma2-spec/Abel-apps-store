import { useEffect, useRef, useState, FormEvent } from 'react'
import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom'
import { supabase, CATEGORIES, CONTENT_TYPES, CONTENT_TYPE_LABELS, ContentType, Item, fmt, latest, apkUrl, fileUrl, imgUrl, slugify, fetchApps } from './lib'

const RISK = 'Install APK files at your own risk. Apps here have not been independently security-scanned. Only install apps from developers you trust.'
const MAX_FILE_BYTES = 50 * 1048576
const FILE_TYPES: Record<Exclude<ContentType, 'app'>, { accept: string; mimeTypes: string[] }> = {
  music: { accept: '.mp3,.m4a,.wav,.ogg,.aac,.flac', mimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac', 'audio/flac'] },
  ebook: { accept: '.pdf,.epub', mimeTypes: ['application/pdf', 'application/epub+zip'] },
  document: { accept: '.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx', mimeTypes: ['application/pdf', 'text/plain', 'text/csv', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'] },
  video: { accept: '.mp4,.webm,.mov', mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'] },
  other: { accept: '.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.mp3,.m4a,.wav,.ogg,.aac,.flac,.mp4,.webm,.mov', mimeTypes: ['application/pdf', 'text/plain', 'text/csv', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'video/mp4', 'video/webm', 'video/quicktime'] },
}
const MIME_BY_EXTENSION: Record<string, string> = {
  apk: 'application/vnd.android.package-archive', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac', flac: 'audio/flac', webm: 'video/webm',
  pdf: 'application/pdf', epub: 'application/epub+zip', txt: 'text/plain', csv: 'text/csv', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', mp4: 'video/mp4', mov: 'video/quicktime', zip: 'application/zip',
}
const fileExtension = (file: File) => file.name.split('.').pop()?.toLowerCase() ?? ''
const fileMime = (file: File) => MIME_BY_EXTENSION[fileExtension(file)] || file.type || ''
const isSupportedFile = (supported: { accept: string; mimeTypes: string[] }, file: File, mime: string) => {
  const extension = `.${fileExtension(file)}`
  return supported.mimeTypes.includes(mime) || supported.mimeTypes.includes(file.type) || supported.accept.split(',').includes(extension)
}
const ADSENSE_CLIENT = String(import.meta.env.VITE_ADSENSE_CLIENT ?? '').trim()
const ADSENSE_SLOT = String(import.meta.env.VITE_ADSENSE_SLOT ?? '').trim()

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[]
  }
}

function AdSlot() {
  const adRef = useRef<HTMLModElement>(null)
  const requested = useRef(false)

  useEffect(() => {
    if (!ADSENSE_CLIENT || !ADSENSE_SLOT || !adRef.current || requested.current) return
    requested.current = true

    if (!document.querySelector('script[src*="pagead/js/adsbygoogle.js"]')) {
      const script = document.createElement('script')
      script.async = true
      script.crossOrigin = 'anonymous'
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`
      document.head.appendChild(script)
    }

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (error) {
      console.error('AdSense could not initialize this ad slot.', error)
    }
  }, [])

  if (!ADSENSE_CLIENT || !ADSENSE_SLOT) return null

  return (
    <aside className="ad-unit" aria-label="Advertisement">
      <span className="ad-label">Advertisement</span>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  )
}

function Download({ a }: { a: Item }) {
  const v = latest(a)
  const url = a.content_type === 'app' ? (v ? apkUrl(v.apk_path) : '') : (a.file_path ? fileUrl(a.file_path, true) : '')
  if (!url) return <span className="muted">File coming soon</span>
  const label = a.content_type === 'app' ? 'Download app'
    : a.content_type === 'music' ? 'Download song'
      : a.content_type === 'ebook' ? 'Download ebook'
        : a.content_type === 'document' ? 'Download document'
          : a.content_type === 'video' ? 'Download video' : 'Download file'
  return <a className="btn" href={url} onClick={() => { void supabase.rpc('record_download', { p_app: a.id }).then(({ error }) => { if (error) console.error('Could not record download.', error) }) }}>{label}</a>
}

function Card({ a }: { a: Item }) {
  const v = latest(a)
  return (
    <article className="card">
      <Link className="top" to={`/app/${a.slug}`}>
        {a.icon_url ? <img className="icon" src={a.icon_url} alt="" loading="lazy" /> : <div className="icon" />}
        <div><strong>{a.name}</strong><div className="muted" style={{ fontSize: '.85rem' }}>{CONTENT_TYPE_LABELS[a.content_type]} · {a.category}</div></div>
      </Link>
      <p className="muted">{a.short_desc}</p>
      <p style={{ fontSize: '.85rem' }}>{a.content_type === 'app' ? (v ? `v${v.version} · ${fmt(v.size_bytes)}` : 'No file yet') : (a.file_size_bytes ? fmt(a.file_size_bytes) : 'No file yet')} · {a.downloads} downloads</p>
      <Download a={a} />
    </article>
  )
}

function useApps() {
  const [apps, setApps] = useState<Item[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { fetchApps().then(d => setApps(d.filter(x => x.published))).catch(e => setErr(e.message)) }, [])
  return { apps, err }
}

function Row({ title, list }: { title: string; list: Item[] }) {
  if (!list.length) return null
  return <><h2>{title}</h2><div className="grid">{list.map(a => <Card key={a.id} a={a} />)}</div></>
}

function Home() {
  const { apps, err } = useApps()
  const [q, setQ] = useState(''); const [cat, setCat] = useState('All')
  const [type, setType] = useState<ContentType | 'all'>('all')
  if (err) return <div className="wrap msg err" role="alert">Could not load apps: {err}</div>
  if (!apps) return <div className="wrap msg">Loading apps…</div>
  const filtered = apps.filter(a => (cat === 'All' || a.category === cat) && (type === 'all' || a.content_type === type) && (a.name + a.short_desc + a.description + a.category).toLowerCase().includes(q.toLowerCase()))
  const filtering = q || cat !== 'All' || type !== 'all'
  return (
    <div className="wrap">
      <section className="hero">
        <span className="eyebrow">THE DIGITAL COLLECTION</span>
        <h1>Good things to <span>discover.</span></h1>
        <p className="muted">Explore apps, music, ebooks, and more—created and shared by Abel.</p>
        <input type="search" aria-label="Search the catalog" placeholder="Search apps, music, ebooks…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="chips" role="group" aria-label="Content types">
          {[['all', 'Everything'], ...CONTENT_TYPES.map(t => [t, CONTENT_TYPE_LABELS[t]] as [string, string])].map(([value, label]) => <button key={value} className={'chip' + (type === value ? ' on' : '')} onClick={() => setType(value as ContentType | 'all')}>{label}</button>)}
        </div>
        <div className="chips categories" role="group" aria-label="Categories">
          {['All', ...CATEGORIES].map(c => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>)}
        </div></section>
      {apps.some(a => a.content_type === 'app') && <div className="warn" role="note">{RISK}</div>}
      <AdSlot />
      {filtering ? <Row title="Results" list={filtered} /> : <>
        <Row title="Featured" list={apps.filter(a => a.featured)} />
        <Row title="Popular downloads" list={[...apps].sort((a, b) => b.downloads - a.downloads).slice(0, 4)} />
        <Row title="Recently added" list={apps.slice(0, 8)} /></>}
      {!apps.length && <p className="msg">Nothing is published yet. Check back soon.</p>}
      {apps.length > 0 && filtering && !filtered.length && <p className="msg">No items match your search.</p>}
    </div>
  )
}

function AppPage() {
  const { slug } = useParams()
  const { apps, err } = useApps()
  const a = apps?.find(x => x.slug === slug)
  useEffect(() => { if (a) document.title = `${a.name} – Abel Apps Store` }, [a])
  if (err) return <div className="wrap msg err">{err}</div>
  if (!apps) return <div className="wrap msg">Loading…</div>
  if (!a) return <NotFound />
  const vs = [...a.versions].sort((x, y) => +new Date(y.released_at) - +new Date(x.released_at))
  const v = vs[0]
  return (
    <div className="wrap" style={{ paddingTop: 24 }}>
      <div className="top">{a.icon_url ? <img className="icon" style={{ width: 88, height: 88 }} src={a.icon_url} alt={`${a.name} icon`} /> : <div className="icon" />}
        <div><span className="eyebrow">{CONTENT_TYPE_LABELS[a.content_type]} · {a.category}</span><h1 style={{ fontSize: '2rem' }}>{a.name}</h1><span className="muted">{a.downloads} downloads</span></div></div>
      <p>{a.description}</p>
      {a.content_type === 'music' && a.file_path && <audio className="audio-player" controls preload="none" src={fileUrl(a.file_path)}>Your browser does not support audio playback.</audio>}
      <Download a={a} />
      {a.content_type === 'app' && <div className="warn" role="note">Android may ask you to allow installs from your browser (“Install unknown apps”). Allow it only for this install. {RISK}</div>}
      {a.features.length > 0 && <><h2>Features</h2><ul>{a.features.map(f => <li key={f}>{f}</li>)}</ul></>}
      {a.screenshots.length > 0 && <><h2>Screenshots</h2><div className="shots">{a.screenshots.map(s => <img key={s} src={s} alt={`${a.name} screenshot`} loading="lazy" />)}</div></>}
      <h2>Details</h2>
      {a.content_type === 'app'
        ? (v ? <p>Version {v.version} · Released {new Date(v.released_at).toLocaleDateString()} · {fmt(v.size_bytes)} · Requires Android {a.min_android}+</p> : <p>No app file uploaded yet.</p>)
        : (a.file_name ? <p>{a.file_name} · {a.file_size_bytes ? fmt(a.file_size_bytes) : ''}</p> : <p>No file uploaded yet.</p>)}
      {a.content_type === 'app' && <><h2>Changelog</h2>{vs.map(x => <div key={x.id}><strong>v{x.version}</strong> <span className="muted">{new Date(x.released_at).toLocaleDateString()}</span><p>{x.notes || 'No notes.'}</p></div>)}</>}
    </div>
  )
}

function NotFound() { return <div className="wrap hero"><h1>404</h1><p className="muted">That page doesn’t exist.</p><Link className="btn" to="/">Back to store</Link></div> }

const GB_LIMIT = Number(import.meta.env.VITE_STORAGE_LIMIT_MB ?? 1024) * 1048576
const pathOf = (url: string) => url.split('/images/')[1]

function Admin() {
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [ok, setOk] = useState<boolean | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [msg, setMsg] = useState(''); const [bad, setBad] = useState(false); const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('')
  const [edit, setEdit] = useState<Item | null>(null)
  const [contentType, setContentType] = useState<ContentType>('app')
  const say = (m: string, e = false) => { setMsg(m); setBad(e) }
  const load = () => fetchApps().then(setItems).catch(e => say(e.message, true))

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!user) { setOk(null); return }
    supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle().then(({ data }) => { setOk(!!data); if (data) load() })
  }, [user])
  useEffect(() => setContentType(edit?.content_type ?? 'app'), [edit])

  const login = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    const { error } = await supabase.auth.signInWithPassword({ email: String(f.get('email')), password: String(f.get('password')) })
    if (error) say(error.message, true)
  }
  const upload = async (bucket: string, path: string, file: File) => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: bucket === 'apks' ? 'application/vnd.android.package-archive' : fileMime(file) })
    if (error) throw error
    return path
  }
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; setBusy(true); setBusyLabel('Preparing...'); say('')
    try {
      const f = new FormData(form); const g = (k: string) => String(f.get(k) ?? '').trim()
      const apk = f.get('apk') as File | null; const asset = f.get('asset') as File | null; const icon = f.get('icon') as File; const shots = (f.getAll('shots') as File[]).filter(s => s.size)
      const selectedType = g('content_type') as ContentType
      if (!CONTENT_TYPES.includes(selectedType)) throw new Error('Choose a supported content type.')
      const supportedFiles = selectedType === 'app' ? null : FILE_TYPES[selectedType]
      if (apk?.size && (!apk.name.toLowerCase().endsWith('.apk') || apk.size > MAX_FILE_BYTES)) throw new Error('APK must be a .apk file up to 50 MB.')
      if (apk?.size && !g('version')) throw new Error('Enter a version number with the APK.')
      const assetMime = asset?.size ? fileMime(asset) : ''
      if (asset?.size && !supportedFiles) throw new Error('Choose an APK file for Android apps.')
      if (asset?.size && supportedFiles && !isSupportedFile(supportedFiles, asset, assetMime)) throw new Error(`That file format is not supported for ${CONTENT_TYPE_LABELS[selectedType].toLowerCase()}. Supported formats: ${supportedFiles.accept.replace(/,/g, ', ')}.`)
      if (asset?.size && asset.size > MAX_FILE_BYTES) throw new Error('Files must be 50 MB or smaller. This is the maximum size allowed by your storage plan.')
      for (const im of [icon, ...shots]) if (im.size && (!/^image\/(png|jpeg|webp)$/.test(im.type) || im.size > 5 * 1048576)) throw new Error('Images must be PNG/JPG/WebP up to 5 MB.')
      const t = Date.now(); const slug = edit?.slug ?? (slugify(g('name')) || `item-${t}`)
      const row: Record<string, unknown> = { name: g('name'), slug, category: g('category'), short_desc: g('short_desc'), description: g('description'),
        content_type: selectedType, features: g('features').split('\n').map(s => s.trim()).filter(Boolean), min_android: g('min_android') || '5.0' }
      if (icon.size) { setBusyLabel('Uploading icon...'); row.icon_url = imgUrl(await upload('images', `${slug}/icon-${t}`, icon)) }
      if (shots.length) { const u: string[] = []; for (const [i, s] of shots.entries()) { setBusyLabel(`Uploading screenshot ${i + 1}/${shots.length}...`); u.push(imgUrl(await upload('images', `${slug}/shot-${t}-${i}`, s))) } row.screenshots = u }
      let nextFilePath: string | null = edit?.file_path ?? null
      if (asset?.size) {
        const safeName = asset.name.replace(/[^a-zA-Z0-9._-]/g, '-')
        nextFilePath = `${slug}/${t}-${safeName}`
        setBusyLabel('Uploading file...')
        await upload('downloads', nextFilePath, asset)
        row.file_path = nextFilePath; row.file_name = asset.name; row.file_size_bytes = asset.size; row.file_content_type = assetMime
      } else if (selectedType === 'app' && edit?.file_path) {
        nextFilePath = null
        row.file_path = null; row.file_name = null; row.file_size_bytes = null; row.file_content_type = null
      }
      let id = edit?.id
      if (edit) { setBusyLabel('Saving app details...'); const { error } = await supabase.from('apps').update(row).eq('id', edit.id); if (error) throw error }
      else { setBusyLabel('Creating app...'); const { data, error } = await supabase.from('apps').insert(row).select('id').single(); if (error) throw error; id = data.id }
      if (edit?.file_path && edit.file_path !== nextFilePath) {
        const { error } = await supabase.storage.from('downloads').remove([edit.file_path])
        if (error) throw new Error(`Saved the listing, but could not remove the replaced file: ${error.message}`)
      }
      if (apk?.size) {
        setBusyLabel('Uploading APK...')
        const path = await upload('apks', `${slug}/${g('version')}-${t}.apk`, apk)
        setBusyLabel('Saving version details...')
        const { error } = await supabase.from('versions').insert({ app_id: id, version: g('version'), apk_path: path, size_bytes: apk.size, notes: g('notes') })
        if (error) throw error
      }
      form.reset(); setEdit(null); say('Saved.'); void load()
    } catch (er) { say((er as Error).message, true) } finally { setBusy(false); setBusyLabel('') }
  }
  const patch = async (id: string, p: Partial<Item>) => { const { error } = await supabase.from('apps').update(p).eq('id', id); if (error) say(error.message, true); else load() }
  const remove = async (a: Item) => {
    if (!confirm(`Delete ${a.name} and all its files?`)) return
    const { error } = await supabase.from('apps').delete().eq('id', a.id)
    if (error) { say(error.message, true); return }
    const apks = a.versions.map(v => v.apk_path)
    const imgs = [a.icon_url, ...a.screenshots].filter(Boolean).map(u => pathOf(u!)).filter(Boolean)
    const results = await Promise.all([
      ...(apks.length ? [supabase.storage.from('apks').remove(apks)] : []),
      ...(imgs.length ? [supabase.storage.from('images').remove(imgs)] : []),
      ...(a.file_path ? [supabase.storage.from('downloads').remove([a.file_path])] : []),
    ])
    const cleanupError = results.find(result => result.error)?.error
    say(cleanupError ? `Listing deleted, but a stored file could not be removed: ${cleanupError.message}` : 'Deleted.', !!cleanupError)
    void load()
  }

  if (!user) return (
    <div className="wrap" style={{ maxWidth: 400, paddingTop: 40 }}><h1>Admin login</h1>
      <form className="f" onSubmit={login}><input name="email" type="email" placeholder="Email" required autoComplete="username" />
        <input name="password" type="password" placeholder="Password" required autoComplete="current-password" /><button className="btn">Sign in</button></form>
      {msg && <p className="msg err" role="alert">{msg}</p>}</div>)
  if (ok === null) return <div className="wrap msg">Checking access…</div>
  if (!ok) return <div className="wrap msg err">This account is not an administrator. <button className="btn alt" onClick={() => supabase.auth.signOut()}>Sign out</button></div>

  const used = items.reduce((s, a) => s + a.versions.reduce((t, v) => t + v.size_bytes, 0) + (a.file_size_bytes ?? 0), 0)
  const publishedCount = items.filter(a => a.published).length
  const downloadCount = items.reduce((total, item) => total + item.downloads, 0)
  return (
    <div className="wrap dashboard">
      <section className="dashboard-hero">
        <div><span className="eyebrow">CREATOR STUDIO</span><h1>Your dashboard</h1><p>Manage your catalog, uploads, and published content in one place.</p></div>
        <div className="dashboard-actions"><button className="btn" type="button" onClick={() => document.getElementById('catalog-editor')?.scrollIntoView({ behavior: 'smooth' })}>＋ Add new item</button><button className="btn alt" onClick={() => supabase.auth.signOut()}>Sign out</button></div>
      </section>
      <section className="dashboard-stats" aria-label="Catalog summary">
        <article className="stat-card"><span className="stat-label">Total items</span><strong>{items.length}</strong><span className="stat-note">In your catalog</span></article>
        <article className="stat-card"><span className="stat-label">Published</span><strong>{publishedCount}</strong><span className="stat-note">Visible to visitors</span></article>
        <article className="stat-card"><span className="stat-label">Total downloads</span><strong>{downloadCount.toLocaleString()}</strong><span className="stat-note">Across all items</span></article>
      </section>
      <section className="storage-card" aria-label="Storage usage">
        <div className="storage-copy"><div><strong>File storage</strong><p className="muted">{fmt(used)} used of {fmt(GB_LIMIT)}</p></div><span>{Math.min(100, Math.round(used / GB_LIMIT * 100))}%</span></div>
        <div className="bar" role="progressbar" aria-label="File storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(used / GB_LIMIT * 100))}><i style={{ width: `${Math.min(100, used / GB_LIMIT * 100)}%` }} /></div>
      </section>
      {msg && <p className={'msg' + (bad ? ' err' : '')} role="status">{msg}</p>}
      <section className="dashboard-section editor-section" id="catalog-editor">
        <div className="section-heading"><div><span className="eyebrow">{edit ? 'UPDATE CONTENT' : 'NEW LISTING'}</span><h2>{edit ? `Edit ${edit.name}` : 'Add to your catalog'}</h2><p className="muted">Share a new app, song, ebook, or other digital file.</p></div></div>
        <form className="f" onSubmit={save} key={edit?.id ?? 'new'}>
          <label>Title<input name="name" placeholder="Item name" required defaultValue={edit?.name} /></label>
          <label>Content type<select name="content_type" value={contentType} onChange={e => setContentType(e.target.value as ContentType)}>{CONTENT_TYPES.map(t => <option key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</option>)}</select></label>
          <label>Category<select name="category" defaultValue={edit?.category ?? 'Other'}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
          <label>Short description<input name="short_desc" placeholder="What is this item?" required defaultValue={edit?.short_desc} /></label>
          <textarea name="description" rows={4} placeholder="Full description" defaultValue={edit?.description} />
          {contentType === 'app' && <>
            <label>Features (one per line)<textarea name="features" rows={3} placeholder="Features" defaultValue={edit?.features.join('\n')} /></label>
            <label>Minimum Android version<input name="min_android" placeholder="e.g. 5.0" defaultValue={edit?.min_android ?? '5.0'} /></label>
          </>}
          <label>Icon (PNG/JPG/WebP)<input name="icon" type="file" accept="image/png,image/jpeg,image/webp" /></label>
          <label>Screenshots (replaces existing)<input name="shots" type="file" accept="image/png,image/jpeg,image/webp" multiple /></label>
          {contentType === 'app'
            ? <><label>APK file (optional for text-only edits)<input name="apk" type="file" accept=".apk" /></label><label>App version<input name="version" placeholder="e.g. 1.0.0 (required with an APK)" /></label><label>Release notes<textarea name="notes" rows={2} placeholder="What changed in this version?" /></label></>
            : <label className="upload-field">Upload {CONTENT_TYPE_LABELS[contentType].toLowerCase()} file<input name="asset" type="file" accept={FILE_TYPES[contentType].accept} /><span className="field-help">Optional when editing details only. Maximum 50 MB. Supported formats: {FILE_TYPES[contentType].accept.replace(/,/g, ', ')}.</span></label>}
          <div className="form-actions"><button className="btn" disabled={busy}>{busy ? busyLabel : edit ? 'Save changes' : 'Add to catalog'}</button> {edit && <button type="button" className="btn alt" onClick={() => setEdit(null)}>Cancel</button>}</div>
        </form>
      </section>
      <section className="dashboard-section">
        <div className="section-heading"><div><span className="eyebrow">YOUR CONTENT</span><h2>Your catalog</h2></div><span className="catalog-count">{items.length} {items.length === 1 ? 'item' : 'items'}</span></div>
        {!items.length ? <div className="empty-catalog"><strong>Your catalog is ready for its first item</strong><p className="muted">Upload music, apps, ebooks, and more to start sharing with your audience.</p><button className="btn" type="button" onClick={() => document.getElementById('catalog-editor')?.scrollIntoView({ behavior: 'smooth' })}>Create your first item</button></div>
          : <div className="catalog-list">{items.map(a => (
            <article className="catalog-item" key={a.id}>
              {a.icon_url ? <img className="catalog-thumb" src={a.icon_url} alt="" /> : <div className="catalog-thumb catalog-placeholder" aria-hidden="true">{CONTENT_TYPE_LABELS[a.content_type].slice(0, 1)}</div>}
              <div className="catalog-details"><div className="catalog-title"><strong>{a.name}</strong><span className={`status-pill${a.published ? ' is-published' : ''}`}>{a.published ? 'Published' : 'Draft'}</span></div><span className="muted">{CONTENT_TYPE_LABELS[a.content_type]} · {a.category} · {a.downloads.toLocaleString()} downloads</span><span className="muted">{a.file_name || (a.versions.length ? `${a.versions.length} app version${a.versions.length === 1 ? '' : 's'}` : 'No file uploaded')}</span></div>
              <div className="catalog-actions"><button className="btn alt" onClick={() => { setEdit(a); document.getElementById('catalog-editor')?.scrollIntoView({ behavior: 'smooth' }) }}>Edit</button><button className="btn alt" onClick={() => patch(a.id, { published: !a.published })}>{a.published ? 'Unpublish' : 'Publish'}</button><button className="btn alt" onClick={() => patch(a.id, { featured: !a.featured })}>{a.featured ? 'Unfeature' : 'Feature'}</button><button className="btn red" onClick={() => remove(a)}>Delete</button></div>
            </article>
          ))}</div>}
      </section>
    </div>)
}

export default function App() {
  return (
    <BrowserRouter>
      <header><div className="wrap"><Link className="brand" to="/"><img src="/logo.svg" alt="" />Abel <span>Digital Store</span></Link><nav><Link to="/">Explore</Link><Link to="/admin">Creator dashboard</Link></nav></div></header>
      <main><Routes><Route path="/" element={<Home />} /><Route path="/app/:slug" element={<AppPage />} /><Route path="/admin" element={<Admin />} /><Route path="*" element={<NotFound />} /></Routes></main>
      <footer><div className="wrap muted">Abel Digital Store · Free downloads shared by Abel. Review files before opening.</div></footer>
    </BrowserRouter>)
}
