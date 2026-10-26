import { useEffect, useState, FormEvent } from 'react'
import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom'
import { supabase, CATEGORIES, Item, fmt, latest, apkUrl, imgUrl, slugify, fetchApps } from './lib'

const RISK = 'Install APK files at your own risk. Apps here have not been independently security-scanned. Only install apps from developers you trust.'

function Download({ a }: { a: Item }) {
  const v = latest(a)
  if (!v) return <span className="muted">APK coming soon</span>
  return <a className="btn" href={apkUrl(v.apk_path)} download onClick={() => { supabase.rpc('record_download', { p_app: a.id }) }}>Download APK</a>
}

function Card({ a }: { a: Item }) {
  const v = latest(a)
  return (
    <article className="card">
      <Link className="top" to={`/app/${a.slug}`}>
        {a.icon_url ? <img className="icon" src={a.icon_url} alt="" loading="lazy" /> : <div className="icon" />}
        <div><strong>{a.name}</strong><div className="muted" style={{ fontSize: '.85rem' }}>{a.category}</div></div>
      </Link>
      <p className="muted">{a.short_desc}</p>
      <p style={{ fontSize: '.85rem' }}>{v ? `v${v.version} · ${fmt(v.size_bytes)}` : 'No file yet'} · {a.downloads} downloads</p>
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
  if (err) return <div className="wrap msg err" role="alert">Could not load apps: {err}</div>
  if (!apps) return <div className="wrap msg">Loading apps…</div>
  const filtered = apps.filter(a => (cat === 'All' || a.category === cat) && (a.name + a.short_desc).toLowerCase().includes(q.toLowerCase()))
  const filtering = q || cat !== 'All'
  return (
    <div className="wrap">
      <section className="hero"><h1>Welcome to Abel Apps Store</h1><p className="muted">Discover and download Android apps made by Abel.</p>
        <input type="search" aria-label="Search apps" placeholder="Search apps…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="chips" role="group" aria-label="Categories">
          {['All', ...CATEGORIES].map(c => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>)}
        </div></section>
      <div className="warn" role="note">{RISK}</div>
      {filtering ? <Row title="Results" list={filtered} /> : <>
        <Row title="Featured" list={apps.filter(a => a.featured)} />
        <Row title="Popular downloads" list={[...apps].sort((a, b) => b.downloads - a.downloads).slice(0, 4)} />
        <Row title="Recently added" list={apps.slice(0, 8)} /></>}
      {!apps.length && <p className="msg">No apps published yet. Check back soon.</p>}
      {apps.length > 0 && filtering && !filtered.length && <p className="msg">No apps match your search.</p>}
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
        <div><h1 style={{ fontSize: '2rem' }}>{a.name}</h1><span className="muted">{a.category} · {a.downloads} downloads</span></div></div>
      <p>{a.description}</p>
      <Download a={a} />
      <div className="warn" role="note">Android may ask you to allow installs from your browser (“Install unknown apps”). Allow it only for this install. {RISK}</div>
      {a.features.length > 0 && <><h2>Features</h2><ul>{a.features.map(f => <li key={f}>{f}</li>)}</ul></>}
      {a.screenshots.length > 0 && <><h2>Screenshots</h2><div className="shots">{a.screenshots.map(s => <img key={s} src={s} alt={`${a.name} screenshot`} loading="lazy" />)}</div></>}
      <h2>Details</h2>
      {v ? <p>Version {v.version} · Released {new Date(v.released_at).toLocaleDateString()} · {fmt(v.size_bytes)} · Requires Android {a.min_android}+</p> : <p>No APK uploaded yet.</p>}
      <h2>Changelog</h2>
      {vs.map(x => <div key={x.id}><strong>v{x.version}</strong> <span className="muted">{new Date(x.released_at).toLocaleDateString()}</span><p>{x.notes || 'No notes.'}</p></div>)}
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

  const login = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    const { error } = await supabase.auth.signInWithPassword({ email: String(f.get('email')), password: String(f.get('password')) })
    if (error) say(error.message, true)
  }
  const upload = async (bucket: string, path: string, file: File) => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: bucket === 'apks' ? 'application/vnd.android.package-archive' : file.type })
    if (error) throw error
    return path
  }
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; setBusy(true); setBusyLabel('Preparing...'); say('')
    try {
      const f = new FormData(form); const g = (k: string) => String(f.get(k) ?? '').trim()
      const apk = f.get('apk') as File; const icon = f.get('icon') as File; const shots = (f.getAll('shots') as File[]).filter(s => s.size)
      if (apk.size && (!apk.name.toLowerCase().endsWith('.apk') || apk.size > 50 * 1048576)) throw new Error('APK must be a .apk file up to 50 MB (Supabase free plan limit).')
      if (apk.size && !g('version')) throw new Error('Enter a version number with the APK.')
      for (const im of [icon, ...shots]) if (im.size && (!/^image\/(png|jpeg|webp)$/.test(im.type) || im.size > 5 * 1048576)) throw new Error('Images must be PNG/JPG/WebP up to 5 MB.')
      const slug = edit?.slug ?? slugify(g('name')); const t = Date.now()
      const row: Record<string, unknown> = { name: g('name'), slug, category: g('category'), short_desc: g('short_desc'), description: g('description'),
        features: g('features').split('\n').map(s => s.trim()).filter(Boolean), min_android: g('min_android') || '5.0' }
      if (icon.size) { setBusyLabel('Uploading icon...'); row.icon_url = imgUrl(await upload('images', `${slug}/icon-${t}`, icon)) }
      if (shots.length) { const u: string[] = []; for (const [i, s] of shots.entries()) { setBusyLabel(`Uploading screenshot ${i + 1}/${shots.length}...`); u.push(imgUrl(await upload('images', `${slug}/shot-${t}-${i}`, s))) } row.screenshots = u }
      let id = edit?.id
      if (edit) { setBusyLabel('Saving app details...'); const { error } = await supabase.from('apps').update(row).eq('id', edit.id); if (error) throw error }
      else { setBusyLabel('Creating app...'); const { data, error } = await supabase.from('apps').insert(row).select('id').single(); if (error) throw error; id = data.id }
      if (apk.size) {
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
    const apks = a.versions.map(v => v.apk_path); const imgs = [a.icon_url, ...a.screenshots].filter(Boolean).map(u => pathOf(u!)).filter(Boolean)
    if (apks.length) await supabase.storage.from('apks').remove(apks)
    if (imgs.length) await supabase.storage.from('images').remove(imgs)
    const { error } = await supabase.from('apps').delete().eq('id', a.id)
    if (error) say(error.message, true); else { say('Deleted.'); load() }
  }

  if (!user) return (
    <div className="wrap" style={{ maxWidth: 400, paddingTop: 40 }}><h1>Admin login</h1>
      <form className="f" onSubmit={login}><input name="email" type="email" placeholder="Email" required autoComplete="username" />
        <input name="password" type="password" placeholder="Password" required autoComplete="current-password" /><button className="btn">Sign in</button></form>
      {msg && <p className="msg err" role="alert">{msg}</p>}</div>)
  if (ok === null) return <div className="wrap msg">Checking access…</div>
  if (!ok) return <div className="wrap msg err">This account is not an administrator. <button className="btn alt" onClick={() => supabase.auth.signOut()}>Sign out</button></div>

  const used = items.reduce((s, a) => s + a.versions.reduce((t, v) => t + v.size_bytes, 0), 0)
  return (
    <div className="wrap" style={{ paddingTop: 24 }}>
      <div className="row"><h1>Dashboard</h1><button className="btn alt" onClick={() => supabase.auth.signOut()}>Sign out</button></div>
      <p>APK storage used: {fmt(used)} of {fmt(GB_LIMIT)}</p><div className="bar"><i style={{ width: `${Math.min(100, used / GB_LIMIT * 100)}%` }} /></div>
      {msg && <p className={'msg' + (bad ? ' err' : '')} role="status">{msg}</p>}
      <h2>Apps</h2>
      {!items.length && <p className="muted">No apps yet.</p>}
      {items.map(a => (
        <div className="row" key={a.id}>
          <div><strong>{a.name}</strong> <span className="muted">{latest(a) ? `v${latest(a).version}` : 'no APK'} · {a.downloads} downloads · {a.published ? 'Published' : 'Draft'}</span></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn alt" onClick={() => { setEdit(a); window.scrollTo(0, document.body.scrollHeight) }}>Edit / new version</button>
            <button className="btn alt" onClick={() => patch(a.id, { published: !a.published })}>{a.published ? 'Unpublish' : 'Publish'}</button>
            <button className="btn alt" onClick={() => patch(a.id, { featured: !a.featured })}>{a.featured ? 'Unfeature' : 'Feature'}</button>
            <button className="btn red" onClick={() => remove(a)}>Delete</button></div></div>))}
      <h2>{edit ? `Edit ${edit.name}` : 'Add app'}</h2>
      <form className="f" onSubmit={save} key={edit?.id ?? 'new'}>
        <input name="name" placeholder="App name" required defaultValue={edit?.name} />
        <select name="category" defaultValue={edit?.category ?? 'Games'}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        <input name="short_desc" placeholder="Short description" required defaultValue={edit?.short_desc} />
        <textarea name="description" rows={4} placeholder="Full description" defaultValue={edit?.description} />
        <textarea name="features" rows={3} placeholder="Features (one per line)" defaultValue={edit?.features.join('\n')} />
        <input name="min_android" placeholder="Minimum Android (e.g. 5.0)" defaultValue={edit?.min_android} />
        <label>Icon (PNG/JPG/WebP)<input name="icon" type="file" accept="image/png,image/jpeg,image/webp" /></label>
        <label>Screenshots (replaces existing)<input name="shots" type="file" accept="image/png,image/jpeg,image/webp" multiple /></label>
        <label>APK file (optional when editing text only)<input name="apk" type="file" accept=".apk" /></label>
        <input name="version" placeholder="Version (e.g. 1.0.0) — required with an APK" />
        <textarea name="notes" rows={2} placeholder="Release notes" />
        <div><button className="btn" disabled={busy}>{busy ? busyLabel : 'Save'}</button> {edit && <button type="button" className="btn alt" onClick={() => setEdit(null)}>Cancel</button>}</div>
      </form>
    </div>)
}

export default function App() {
  return (
    <BrowserRouter>
      <header><div className="wrap"><Link className="brand" to="/"><img src="/logo.svg" alt="" />Abel Apps Store</Link><nav><Link to="/">Apps</Link><Link to="/admin">Admin</Link></nav></div></header>
      <main><Routes><Route path="/" element={<Home />} /><Route path="/app/:slug" element={<AppPage />} /><Route path="/admin" element={<Admin />} /><Route path="*" element={<NotFound />} /></Routes></main>
      <footer><div className="wrap muted">{RISK}</div></footer>
    </BrowserRouter>)
}
