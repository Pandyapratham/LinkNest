import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api, API_BASE_URL } from './api'
import SyllabusLab from './SyllabusLab'
import './App.css'

const iconPaths = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.07 0l3-3A5 5 0 0 0 13 2.93l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 0 0 11 21.07l1.71-1.71" /></>,
  chart: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-5 5" /></>,
  palette: <><circle cx="13.5" cy="6.5" r=".5" /><circle cx="17.5" cy="10.5" r=".5" /><circle cx="8.5" cy="7.5" r=".5" /><circle cx="6.5" cy="12.5" r=".5" /><path d="M12 22a10 10 0 1 1 10-10c0 1.7-1.3 3-3 3h-1.8c-.9 0-1.4 1-.9 1.7.7.9.2 2.3-1 2.3H12Z" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2Z" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>, arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
  dots: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
  trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
  close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>, eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  external: <><path d="M14 3h7v7m0-7L10 14" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
}
function Icon({ name, size = 18, strokeWidth = 1.8, ...props }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{iconPaths[name]}</svg> }

const tones = ['mint', 'peach', 'lilac', 'blue']
const emptyProfile = { slug: '', displayName: '', bio: '', avatarUrl: '', theme: 'soft', enabled: true, socialLinks: [] }
const emptyLink = { title: '', destinationUrl: '', description: '', icon: '', platform: 'website', enabled: true }
const publicPath = window.location.pathname.match(/^\/u\/([a-z0-9-]+)\/?$/i)

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', email: '', identifier: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault(); setError('')
    if (mode === 'register' && !/^[a-zA-Z0-9_]{3,24}$/.test(form.username.trim())) { setError('Choose a username with 3–24 letters, numbers, or underscores.'); return }
    if (mode === 'register' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError('Enter a valid email address.'); return }
    if (mode === 'login' && !form.identifier.trim()) { setError('Enter your email address or username.'); return }
    if (form.password.length < 8) { setError('Your password must be at least 8 characters.'); return }
    setBusy(true)
    try {
      const result = mode === 'login' ? await api.login({ identifier: form.identifier.trim(), password: form.password }) : await api.register({ username: form.username.trim(), email: form.email.trim(), password: form.password })
      onAuthenticated(result.user)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <div className="auth-screen"><div className="auth-card"><a className="brand auth-brand" href="/"><span className="brand-mark"><Icon name="link" size={20} strokeWidth={2.2} /></span><span>Pinpoint<span className="brand-dot">.</span></span></a><div className="section-kicker">YOUR CORNER OF THE INTERNET</div><h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1><p className="modal-description">{mode === 'login' ? 'Sign in to manage your Pinpoint page.' : 'Start building a home for all your links.'}</p>
    {error && <div className="integration-error" role="alert">{error}</div>}<form onSubmit={submit}>{mode === 'register' && <><label htmlFor="auth-username">Username</label><input id="auth-username" autoComplete="username" maxLength={24} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required /></>}{mode === 'login' ? <><label htmlFor="auth-identifier">Email or username</label><input id="auth-identifier" type="text" autoComplete="username" placeholder="you@example.com or username" maxLength={254} value={form.identifier} onChange={e => setForm({ ...form, identifier: e.target.value })} required /></> : <><label htmlFor="auth-email">Email</label><input id="auth-email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></>}<label htmlFor="auth-password">Password</label><input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /><button className="button button-primary auth-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} <Icon name="arrow" size={15} /></button></form><p className="auth-switch">{mode === 'login' ? 'New to Pinpoint?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p></div></div>
}

export function PublicProfilePage({ slug }) {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  useEffect(() => { let active = true; api.publicProfile(slug).then(result => { if (active) setData(result.profile) }).catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [slug])
  if (error) return <div className="public-page"><a className="brand" href="/"><span className="brand-mark"><Icon name="link" /></span><span>Pinpoint<span className="brand-dot">.</span></span></a><p className="public-message">{error}</p></div>
  if (!data) return <div className="public-page"><p className="public-message">Loading profile…</p></div>
  return <div className="public-page"><div className={`public-card theme-${data.theme || 'soft'}`}>{data.avatarUrl ? <img className="public-avatar" src={data.avatarUrl} alt={`${data.displayName} profile`} /> : <div className="public-avatar public-avatar-placeholder" aria-hidden="true">{data.displayName?.slice(0, 1)?.toUpperCase()}</div>}<h1>{data.displayName}</h1>{data.bio && <p>{data.bio}</p>}<div className="public-links">{(data.links || []).map(link => <a className="public-link" key={link.id} href={`${API_BASE_URL}/api/redirect/${encodeURIComponent(data.slug)}/${encodeURIComponent(link.id)}`}><span>{link.icon || '↗'}</span><strong>{link.title}</strong><Icon name="arrow" size={15} /></a>)}</div>{data.socialLinks?.length > 0 && <nav className="public-socials" aria-label="Social profiles">{data.socialLinks.map(item => <a key={item.platform} href={item.url} target="_blank" rel="noreferrer">{item.label || item.platform}</a>)}</nav>}<small>Made with Pinpoint</small></div></div>
}

function App() {
  const [authState, setAuthState] = useState('loading')
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [links, setLinks] = useState([])
  const [loadingWorkspace, setLoadingWorkspace] = useState(false)
  const [workspaceError, setWorkspaceError] = useState('')
  const [modal, setModal] = useState(null)
  const [draft, setDraft] = useState(emptyLink)
  const [profileDraft, setProfileDraft] = useState(emptyProfile)
  const [socialDraft, setSocialDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeNav, setActiveNav] = useState('Overview')
  const [range, setRange] = useState('7d')
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState('')
  const qrRef = useRef(null)
  const modalRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState('')
  const [publicData, setPublicData] = useState(null)
  const sessionRequest = useRef(null)

  const notify = useCallback(message => { setToast(message); window.setTimeout(() => setToast(''), 2600) }, [])
  const loadAnalytics = useCallback(async (selectedRange = '7d') => {
    setAnalyticsLoading(true); setAnalyticsError('')
    try { setAnalytics(await api.getAnalytics(selectedRange)) } catch (error) { setAnalyticsError(error.message); setAnalytics(null) } finally { setAnalyticsLoading(false) }
  }, [])
  const loadWorkspace = useCallback(async () => {
    setLoadingWorkspace(true); setWorkspaceError(''); setProfile(null); setLinks([]); setPublicData(null); setAnalytics(null); setAnalyticsError('')
    try {
      let currentProfile
      try { currentProfile = (await api.getProfile()).profile } catch (e) { if (e.status !== 404) throw e }
      if (currentProfile) {
        setProfile(currentProfile)
        const result = await api.getLinks(); const rows = result.links || []
        setLinks(rows)
        try { setPublicData((await api.publicProfile(currentProfile.slug)).profile) } catch { setPublicData(null) }
        await loadAnalytics('7d')
      }
    } catch (e) { setWorkspaceError(e.message) } finally { setLoadingWorkspace(false) }
  }, [loadAnalytics])
  const refreshPublicPreview = useCallback(async (slug = profile?.slug) => {
    if (!slug) { setPublicData(null); return }
    try { setPublicData((await api.publicProfile(slug)).profile) } catch { setPublicData(null) }
  }, [profile?.slug])
  useEffect(() => {
    let active = true
    sessionRequest.current ||= api.me()
    sessionRequest.current.then(async result => {
      if (!active) return
      setUser(result.user)
      await loadWorkspace()
      if (active) setAuthState('ready')
    }).catch(() => { if (active) { setUser(null); setAuthState('signed-out') } })
    return () => { active = false }
  }, [loadWorkspace])
  useEffect(() => {
    if (!modal) return undefined
    const previousFocus = document.activeElement
    const dialog = modalRef.current
    const firstFocusable = dialog?.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')
    firstFocusable?.focus()
    return () => { if (previousFocus?.isConnected) previousFocus.focus() }
    }, [modal])

  const activeLinks = useMemo(() => links.filter(link => link.enabled), [links])
  function openAdd() { setDraft({ ...emptyLink, displayOrder: links.length }); setModal({ type: 'add' }) }
  function openEdit(link) { setDraft({ ...emptyLink, ...link, destinationUrl: link.destinationUrl || '' }); setModal({ type: 'edit', id: link.id }) }
  function openProfileEditor() {
    if (!profile) { setProfileDraft({ ...emptyProfile, displayName: user?.username || '' }); setSocialDraft('') }
    else { setProfileDraft({ ...emptyProfile, ...profile }); setSocialDraft((profile.socialLinks || []).map(item => `${item.platform}|${item.url}|${item.label || ''}`).join('\n')) }
    setModal({ type: profile ? 'profile-edit' : 'profile-create' })
  }
  function parseSocialLinks() {
    return socialDraft.split('\n').map(line => line.trim()).filter(Boolean).map(line => { const [platform, url, label = ''] = line.split('|').map(part => part.trim()); return { platform, url, ...(label ? { label } : {}) } })
  }
  async function saveLink(event) {
    event.preventDefault(); if (!draft.title.trim()) return
    let parsed; try { parsed = new URL(/^https?:\/\//i.test(draft.destinationUrl.trim()) ? draft.destinationUrl.trim() : `https://${draft.destinationUrl.trim()}`) } catch { notify('Enter a valid website address'); return }
    if (!['http:', 'https:'].includes(parsed.protocol)) { notify('Links must use http or https'); return }
    const body = { title: draft.title.trim(), destinationUrl: parsed.href, description: draft.description.trim(), icon: draft.icon.trim(), platform: draft.platform, enabled: Boolean(draft.enabled), displayOrder: Number(draft.displayOrder ?? links.length) }
    setSaving(true)
    try {
      if (modal.type === 'edit') { const result = await api.updateLink(modal.id, body); setLinks(rows => rows.map(row => row.id === modal.id ? result.link : row)); notify('Your link has been updated') }
      else { const result = await api.createLink(body); setLinks(rows => [...rows, result.link].sort((a, b) => a.displayOrder - b.displayOrder)); notify('New link added to your page') }
      await refreshPublicPreview()
      setModal(null)
    } catch (e) { notify(e.message) } finally { setSaving(false) }
  }
  async function deleteLink(id) { setSaving(true); try { await api.deleteLink(id); setLinks(rows => rows.filter(row => row.id !== id)); setModal(null); notify('Link deleted'); await refreshPublicPreview() } catch (e) { notify(e.message) } finally { setSaving(false) } }
  async function toggleLink(link) { try { const result = await api.updateLink(link.id, { enabled: !link.enabled }); setLinks(rows => rows.map(row => row.id === link.id ? result.link : row)); await refreshPublicPreview() } catch (e) { notify(e.message) } }
  async function moveLink(index, delta) {
    const target = index + delta; if (target < 0 || target >= links.length) return
    const next = [...links]; [next[index], next[target]] = [next[target], next[index]]
    try { const result = await api.reorderLinks(next.map(link => link.id)); if (result.links) setLinks(result.links); else setLinks(next.map((link, i) => ({ ...link, displayOrder: i }))); await refreshPublicPreview() } catch (e) { notify(e.message) }
  }
  async function saveProfile(event) {
    event.preventDefault()
    const slug = profileDraft.slug.trim().toLowerCase()
    if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug)) { notify('Slug must be 3–40 lowercase letters, numbers, or hyphens.'); return }
    if (!profileDraft.displayName.trim()) { notify('Add a display name for your profile.'); return }
    let socialLinks; try { socialLinks = parseSocialLinks() } catch { notify('Check the social links format.'); return }
    const body = { slug, displayName: profileDraft.displayName.trim(), bio: profileDraft.bio.trim(), avatarUrl: profileDraft.avatarUrl.trim(), theme: profileDraft.theme, enabled: Boolean(profileDraft.enabled), socialLinks }
    setSaving(true)
    try {
      const result = modal.type === 'profile-create' ? await api.createProfile(body) : await api.updateProfile(body)
      setProfile(result.profile); setModal(null); notify('Profile settings saved'); await loadWorkspace()
    } catch (e) { notify(e.message) } finally { setSaving(false) }
  }
  async function logout() { try { await api.logout(); setUser(null); setProfile(null); setLinks([]); setPublicData(null); setAnalytics(null); setRange('7d'); setAuthState('signed-out') } catch (e) { notify(`Could not sign out: ${e.message}`) } }
  async function acceptAuthentication(nextUser) { setAuthState('loading'); setUser(nextUser); setRange('7d'); await loadWorkspace(); setAuthState('ready') }
  async function copyProfile() {
    if (!profile?.slug) { notify('Create your profile to get a public link.'); return }
    const url = `${window.location.origin}/u/${profile.slug}`
    try { await navigator.clipboard.writeText(url); setCopied(true); notify('Profile link copied to clipboard'); window.setTimeout(() => setCopied(false), 1800) } catch { notify(url) }
  }
  function openPublicPage() { if (profile?.slug) window.open(`/u/${encodeURIComponent(profile.slug)}`, '_blank', 'noopener,noreferrer'); else openProfileEditor() }
  function downloadQr() {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return
    const href = URL.createObjectURL(new Blob([svg.outerHTML], { type: 'image/svg+xml;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = href; anchor.download = `${profile.slug}-Pinpoint-qr.svg`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(href), 1000)
  }
  function handleDialogKeyDown(event) {
    if (event.key === 'Escape' && !saving) { setModal(null); return }
    if (event.key !== 'Tab') return
    const focusable = [...(modalRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]') || [])]
    if (!focusable.length) { event.preventDefault(); return }
    const first = focusable[0]; const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  if (publicPath) return <PublicProfilePage slug={decodeURIComponent(publicPath[1])} />
  if (authState === 'loading') return <div className="auth-screen"><div className="loading-card">Loading your Pinpoint workspace…</div></div>
  if (authState === 'signed-out') return <AuthScreen onAuthenticated={acceptAuthentication} />
  const displayName = profile?.displayName || user?.username || 'Your profile'
  const initials = displayName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
  const profileUrl = profile ? `${window.location.host}/u/${profile.slug}` : 'Create your public profile'
  const chartMax = Math.max(0, ...(analytics?.daily || []).map(item => item.clicks))
  const chartTicks = [chartMax, Math.round(chartMax * .75), Math.round(chartMax * .5), Math.round(chartMax * .25), 0]
  const deviceCounts = Object.fromEntries((analytics?.devices || []).map(item => [item._id, item.clicks]))
  const deviceTotal = analytics?.totalClicks || 0
  const deviceAngle = (deviceCounts.desktop || 0) / Math.max(deviceTotal, 1) * 360
  const mobileAngle = deviceAngle + (deviceCounts.mobile || 0) / Math.max(deviceTotal, 1) * 360
  const tabletAngle = mobileAngle + (deviceCounts.tablet || 0) / Math.max(deviceTotal, 1) * 360

  const navItems = [{ label: 'Overview', icon: 'grid' }, { label: 'My links', icon: 'link' }, { label: 'Analytics', icon: 'chart' }, { label: 'Appearance', icon: 'palette' }, { label: 'Syllabus Lab', icon: 'settings' }]
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}><a className="brand" href="#overview" onClick={() => setActiveNav('Overview')}><span className="brand-mark"><Icon name="link" size={20} strokeWidth={2.2} /></span><span>Pinpoint<span className="brand-dot">.</span></span></a><div className="workspace-label">WORKSPACE</div><div className="workspace-switch"><span className="workspace-avatar">{initials}</span><span className="workspace-name">{displayName}’s space</span><span className="workspace-chevron">⌄</span></div>
      <nav className="side-nav" aria-label="Main navigation">{navItems.map(item => <button key={item.label} className={`nav-item ${activeNav === item.label ? 'nav-active' : ''}`} onClick={() => { setActiveNav(item.label); setMenuOpen(false); if (item.label === 'My links') document.getElementById('links')?.scrollIntoView({ behavior: 'smooth' }); if (item.label === 'Analytics') document.getElementById('analytics')?.scrollIntoView({ behavior: 'smooth' }); if (item.label === 'Appearance') openProfileEditor(); if (item.label === 'Overview') window.scrollTo({ top: 0, behavior: 'smooth' }) }}><Icon name={item.icon} size={18} /><span>{item.label}</span>{item.label === 'My links' && <span className="nav-count">{links.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-sparkle">✦</div><strong>Make it yours</strong><p>Unlock themes and custom domains.</p><button onClick={openProfileEditor}>Edit your profile <span>↗</span></button></div><button className="nav-item settings-item" onClick={openProfileEditor}><Icon name="settings" size={18} /><span>Profile settings</span></button><div className="user-card"><div className="user-avatar">{initials}</div><div className="user-details"><strong>{user?.username || displayName}</strong><span>{user?.email}</span></div><button className="icon-button user-more" aria-label="Sign out" title="Sign out" onClick={logout}><Icon name="dots" /></button></div></div>
    </aside>
    <main className="main-area" id="overview"><header className="topbar"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" size={20} /></button><div className="breadcrumb">Workspace <span>/</span> <strong>{activeNav}</strong></div><div className="topbar-right"><span className="status-pill"><i /> {loadingWorkspace ? 'Syncing…' : 'Connected'}</span><button className="top-avatar" aria-label={`Sign out ${displayName}`} onClick={logout}>{initials}</button></div></header>
      <div className={`page-content ${activeNav === 'Syllabus Lab' ? 'lab-open' : ''}`}>{activeNav === 'Syllabus Lab' && <SyllabusLab onImportComplete={loadWorkspace} />}<section className="welcome-row"><div><div className="eyebrow">PINPOINT WORKSPACE</div><h1>Welcome, {displayName.split(' ')[0]} <span className="wave">✦</span></h1><p className="welcome-subtitle">Here’s what’s happening with your corner of the internet.</p></div><button className="button button-primary" onClick={openAdd} disabled={!profile}><Icon name="plus" size={17} /> Add a new link</button></section>
        {workspaceError && <div className="integration-error workspace-alert" role="alert">{workspaceError} <button onClick={loadWorkspace}>Try again</button></div>}
        {!profile && !loadingWorkspace && !workspaceError && <div className="setup-banner"><div><strong>Your page is almost ready</strong><p>Create a profile to choose its public address and start adding links.</p></div><button className="button button-primary" onClick={openProfileEditor}>Set up profile <Icon name="arrow" size={15} /></button></div>}
        <section className="stats-grid" aria-label="Dashboard overview"><article className="stat-card"><div className="stat-top"><span>Total clicks</span><span className="stat-icon violet"><Icon name="chart" size={17} /></span></div><div className="stat-value">{analyticsLoading ? '…' : (analytics?.totalClicks || 0).toLocaleString()}</div><div className="stat-foot"><span className="muted-highlight">{range} period</span><span>recorded link visits</span></div></article><article className="stat-card"><div className="stat-top"><span>Profile views</span><span className="stat-icon peach"><Icon name="eye" size={17} /></span></div><div className="stat-value">—</div><div className="stat-foot"><span className="muted-highlight">Not tracked</span><span>page view tracking unavailable</span></div></article><article className="stat-card"><div className="stat-top"><span>Click-through rate</span><span className="stat-icon mint"><Icon name="arrow" size={17} /></span></div><div className="stat-value">—</div><div className="stat-foot"><span className="muted-highlight">Not available</span><span>profile views are not tracked</span></div></article><article className="stat-card"><div className="stat-top"><span>Active links</span><span className="stat-icon blue"><Icon name="link" size={17} /></span></div><div className="stat-value">{activeLinks.length}<span className="stat-unit">/{links.length}</span></div><div className="stat-foot"><span className="muted-highlight">{profile?.enabled ? 'Looking good' : 'Profile offline'}</span><span>enabled links</span><span className="live-dot" /></div></article></section>
        <section className="middle-grid"><article className="panel analytics-panel" id="analytics"><div className="panel-heading"><div><div className="section-kicker">YOUR PERFORMANCE</div><h2>Clicks over time</h2></div><select className="range-select" value={range} onChange={e => { setRange(e.target.value); loadAnalytics(e.target.value) }} aria-label="Analytics date range"><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option></select></div><div className="chart-summary"><strong>{analyticsLoading ? 'Loading…' : (analytics?.totalClicks || 0).toLocaleString()}</strong><span className="summary-period">actual tracked clicks · {range}</span></div>{analyticsError && <p className="integration-error" role="alert">{analyticsError} <button onClick={() => loadAnalytics(range)}>Retry</button></p>}<div className="chart-wrap"><div className="chart-y-labels">{chartTicks.map((value, index) => <span key={index}>{value.toLocaleString()}</span>)}</div><div className="chart-main"><div className="chart-gridlines"><i /><i /><i /><i /><i /></div><div className="bar-chart">{(analytics?.daily || []).map((item, index) => <div className="bar-column" key={item.date} title={`${item.date}: ${item.clicks} clicks`}><div className={`bar ${index === (analytics?.daily?.length || 0) - 1 ? 'bar-highlight' : ''}`} style={{ height: `${Math.max(3, item.clicks / Math.max(chartMax, 1) * 100)}%` }} /></div>)}</div><div className="chart-x-labels chart-date-labels">{(analytics?.daily || []).filter((_, index, all) => index === 0 || index === all.length - 1 || index % Math.ceil(all.length / 7) === 0).map(item => <span key={item.date}>{item.date.slice(5)}</span>)}</div></div></div><div className="chart-legend"><span className="legend-dot" /> Daily click events <span className="chart-note">UTC · {analytics?.privacy || ''}</span></div>{analytics?.topLinks?.length > 0 && <div className="top-links-summary"><strong>Top links</strong>{analytics.topLinks.slice(0, 3).map(item => <span key={String(item._id)}>{item.title}<b>{item.clicks}</b></span>)}</div>}</article>
          <article className="panel profile-panel"><div className="panel-heading"><div><div className="section-kicker">YOUR PUBLIC PAGE</div><h2>Profile preview</h2></div><div className="profile-tools"><button className="icon-button subtle-button" aria-label="Show profile QR code" onClick={() => setModal({ type: 'qr' })} disabled={!profile?.enabled}><span aria-hidden="true">▦</span></button><button className="icon-button subtle-button" aria-label="Open public page" onClick={openPublicPage}><Icon name="external" size={17} /></button></div></div><div className="profile-preview"><div className="preview-topline"><span>{profileUrl}</span><button title="Copy profile link" onClick={copyProfile}><Icon name="copy" size={14} />{copied ? 'Copied!' : 'Copy'}</button></div><div className={`preview-inner theme-${profile?.theme || 'soft'}`}>{profile?.avatarUrl ? <img className="profile-photo" src={profile.avatarUrl} alt="" /> : <div className="profile-photo">{initials}<span className="photo-sparkle">✦</span></div>}<strong className="preview-name">{profile?.displayName || 'Your display name'}</strong><span className="preview-bio">{profile?.bio || 'Your bio will appear here.'}</span><div className="preview-handle">@{profile?.slug || user?.username}</div><div className="preview-links">{(publicData?.links || []).slice(0, 3).map((link, index) => <div className="preview-link" key={link.id || link.title}><span className={`preview-link-icon ${tones[index % tones.length]}`}>{link.icon || '↗'}</span><span>{link.title}</span><Icon name="arrow" size={13} /></div>)}{!publicData?.links?.length && <span className="preview-bio">{profile?.enabled ? 'Your enabled links will show here.' : 'This page is currently unpublished.'}</span>}</div><div className="preview-footer">Made with <b>Pinpoint<span>.</span></b></div></div></div></article></section>
        <section className="bottom-grid"><article className="panel links-panel" id="links"><div className="panel-heading links-heading"><div><div className="section-kicker">MAKE EVERY CLICK COUNT</div><h2>Your links <span className="heading-count">{links.length}</span></h2></div><button className="button button-light" onClick={openAdd} disabled={!profile}><Icon name="plus" size={16} /> Add link</button></div>
          {loadingWorkspace ? <div className="empty-state"><strong>Loading your links…</strong></div> : links.length ? <div className="links-table"><div className="table-labels"><span>LINK</span><span>CLICKS</span><span>STATUS</span><span /></div>{links.map((link, index) => <div className="link-row" key={link.id}><div className="link-main"><span className={`link-icon ${tones[index % tones.length]}`}>{link.icon || '↗'}</span><div className="link-copy"><strong>{link.title}</strong><span>{link.destinationUrl}</span>{link.description && <span>{link.description}</span>}</div></div><span className="link-clicks">{analytics?.topLinks?.find(item => String(item._id) === link.id)?.clicks || 0}</span><span className={`link-status ${link.enabled ? '' : 'status-disabled'}`}><i /> {link.enabled ? 'Active' : 'Disabled'}</span><div className="row-actions"><button className="icon-button reorder-action" aria-label={`Move ${link.title} up`} disabled={index === 0} onClick={() => moveLink(index, -1)}>↑</button><button className="icon-button reorder-action" aria-label={`Move ${link.title} down`} disabled={index === links.length - 1} onClick={() => moveLink(index, 1)}>↓</button><button className="icon-button" aria-label={link.enabled ? `Disable ${link.title}` : `Enable ${link.title}`} title={link.enabled ? 'Disable link' : 'Enable link'} onClick={() => toggleLink(link)}>{link.enabled ? '●' : '○'}</button><button className="icon-button" aria-label={`Edit ${link.title}`} onClick={() => openEdit(link)}><Icon name="edit" size={16} /></button><button className="icon-button delete-action" aria-label={`Delete ${link.title}`} onClick={() => setModal({ type: 'delete', id: link.id, title: link.title })}><Icon name="trash" size={16} /></button></div></div>)}</div> : <div className="empty-state"><div className="empty-icon"><Icon name="link" size={23} /></div><strong>{profile ? 'Your page is ready for its first link' : 'Create your profile to get started'}</strong><span>{profile ? 'Add a link to help people find your work.' : 'Choose your public name and page address first.'}</span><button className="button button-primary" onClick={profile ? openAdd : openProfileEditor}><Icon name="plus" size={16} /> {profile ? 'Add your first link' : 'Set up profile'}</button></div>}
          <div className="links-panel-foot"><span>Use the arrows to change your public link order</span><span className="drag-dots">⠿</span></div></article>
          <article className="panel devices-panel"><div className="panel-heading"><div><div className="section-kicker">KNOW YOUR AUDIENCE</div><h2>Devices</h2></div><span className="device-estimate">coarse UA estimate</span></div><div className="device-content"><div className={`donut-chart ${deviceTotal ? '' : 'donut-empty'}`} style={deviceTotal ? { background: `conic-gradient(#8062e6 0deg ${deviceAngle}deg,#f2a579 ${deviceAngle}deg ${mobileAngle}deg,#76c4ac ${mobileAngle}deg ${tabletAngle}deg,#c6c2d0 ${tabletAngle}deg 360deg)` } : undefined}><div className="donut-hole"><strong>{deviceTotal.toLocaleString()}</strong><span>Total clicks</span></div></div><div className="device-legend">{[['desktop','Desktop','desktop-dot'],['mobile','Mobile','mobile-dot-dot'],['tablet','Tablet','tablet-dot'],['unknown','Unknown','unknown-dot']].map(([key,label,color]) => <div key={key}><span className="device-name"><i className={`device-dot ${color}`} />{label}</span><strong>{deviceTotal ? `${Math.round((deviceCounts[key] || 0) / deviceTotal * 100)}%` : '—'}</strong></div>)}</div></div><div className="devices-foot"><span className="devices-foot-icon">✦</span><span><strong>{deviceTotal ? 'Approximate device categories' : 'No click events in this period'}</strong><br />Based on a coarse user-agent category; raw user agents are discarded.</span></div></article></section>
        <footer className="page-footer"><span>© 2026 Pinpoint</span><span>Made for your next chapter <span className="footer-heart">♥</span></span><a href="#overview">Back to top ↑</a></footer>
      </div>
    </main>
    {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setModal(null) }}><div ref={modalRef} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title" onKeyDown={handleDialogKeyDown}><button className="icon-button modal-close" aria-label="Close dialog" onClick={() => !saving && setModal(null)}><Icon name="close" size={18} /></button>
      {modal.type === 'delete' ? <><div className="modal-symbol modal-danger"><Icon name="trash" size={20} /></div><div className="section-kicker">REMOVE LINK</div><h2 id="modal-title">Delete this link?</h2><p className="modal-description"><strong>{modal.title}</strong> will be removed from your page. You can add it again anytime.</p><div className="modal-actions"><button className="button button-light" onClick={() => setModal(null)}>Keep link</button><button className="button button-delete" disabled={saving} onClick={() => deleteLink(modal.id)}>{saving ? 'Deleting…' : 'Delete link'}</button></div></>
      : modal.type === 'qr' ? <><div className="modal-symbol"><Icon name="external" size={20} /></div><div className="section-kicker">SHARE YOUR PAGE</div><h2 id="modal-title">Profile QR code</h2><p className="modal-description">Scan to open your published Pinpoint profile.</p><div className="qr-preview" ref={qrRef}><QRCodeSVG value={`${window.location.origin}/u/${profile.slug}`} size={220} level="H" includeMargin /></div><p className="qr-url">{window.location.origin}/u/{profile.slug}</p><div className="modal-actions"><button className="button button-light" onClick={() => setModal(null)}>Close</button><button className="button button-primary" onClick={downloadQr}>Download SVG</button></div></>
      : modal.type.startsWith('profile-') ? <><div className="modal-symbol"><Icon name="palette" size={20} /></div><div className="section-kicker">YOUR PUBLIC PAGE</div><h2 id="modal-title">{modal.type === 'profile-create' ? 'Set up your profile' : 'Profile settings'}</h2><p className="modal-description">These details appear on your public Pinpoint page.</p><form onSubmit={saveProfile}><label htmlFor="profile-name">Display name</label><input id="profile-name" maxLength={80} value={profileDraft.displayName} onChange={e => setProfileDraft({ ...profileDraft, displayName: e.target.value })} required /><label htmlFor="profile-slug">Public page address</label><div className="url-input"><span>/u/</span><input id="profile-slug" maxLength={40} value={profileDraft.slug} onChange={e => setProfileDraft({ ...profileDraft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} required /></div><label htmlFor="profile-bio">Bio</label><textarea id="profile-bio" rows="3" maxLength={280} value={profileDraft.bio || ''} onChange={e => setProfileDraft({ ...profileDraft, bio: e.target.value })} /><label htmlFor="profile-avatar">Avatar image URL</label><input id="profile-avatar" type="url" placeholder="https://…" value={profileDraft.avatarUrl || ''} onChange={e => setProfileDraft({ ...profileDraft, avatarUrl: e.target.value })} /><label htmlFor="profile-theme">Theme</label><select id="profile-theme" value={profileDraft.theme} onChange={e => setProfileDraft({ ...profileDraft, theme: e.target.value })}><option value="soft">Soft</option><option value="light">Light</option><option value="dark">Dark</option><option value="midnight">Midnight</option><option value="sunset">Sunset</option></select><label htmlFor="profile-social">Social links <span className="field-hint">one per line: platform | URL | label (optional)</span></label><textarea id="profile-social" rows="3" placeholder={'instagram | https://instagram.com/you | Instagram'} value={socialDraft} onChange={e => setSocialDraft(e.target.value)} /><label className="checkbox-label"><input type="checkbox" checked={Boolean(profileDraft.enabled)} onChange={e => setProfileDraft({ ...profileDraft, enabled: e.target.checked })} /> Publish this profile</label><div className="modal-actions"><button type="button" className="button button-light" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save profile'} <Icon name="arrow" size={15} /></button></div></form></>
      : <><div className="modal-symbol"><Icon name={modal.type === 'edit' ? 'edit' : 'plus'} size={20} /></div><div className="section-kicker">{modal.type === 'edit' ? 'UPDATE YOUR PAGE' : 'GROW YOUR PAGE'}</div><h2 id="modal-title">{modal.type === 'edit' ? 'Edit your link' : 'Add a new link'}</h2><p className="modal-description">Make it easy for people to find what you’re sharing.</p><form onSubmit={saveLink}><label htmlFor="link-title">Link title</label><input autoFocus id="link-title" placeholder="e.g. My portfolio" maxLength={80} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} required /><label htmlFor="link-url">Destination URL</label><div className="url-input"><span>↗</span><input id="link-url" type="url" placeholder="https://yourwebsite.com" maxLength={2048} value={draft.destinationUrl} onChange={e => setDraft({ ...draft, destinationUrl: e.target.value })} required /></div><label htmlFor="link-description">Description <span className="field-hint">optional</span></label><textarea id="link-description" rows="2" maxLength={280} value={draft.description || ''} onChange={e => setDraft({ ...draft, description: e.target.value })} /><label htmlFor="link-platform">Platform</label><select id="link-platform" value={draft.platform || 'website'} onChange={e => setDraft({ ...draft, platform: e.target.value })}>{['website', 'instagram', 'tiktok', 'youtube', 'x', 'linkedin', 'github', 'spotify', 'facebook', 'other'].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select><label htmlFor="link-icon">Icon or symbol <span className="field-hint">optional</span></label><input id="link-icon" maxLength={50} value={draft.icon || ''} onChange={e => setDraft({ ...draft, icon: e.target.value })} /><label className="checkbox-label"><input type="checkbox" checked={Boolean(draft.enabled)} onChange={e => setDraft({ ...draft, enabled: e.target.checked })} /> Enabled on public page</label><div className="modal-actions"><button type="button" className="button button-light" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : modal.type === 'edit' ? 'Save changes' : 'Add link'} <Icon name="arrow" size={15} /></button></div></form></>}
    </div></div>}
    {toast && <div className="toast-message" role="status" aria-live="polite"><span>✓</span>{toast}</div>}
  </div>
}

export default function RootApp() { return publicPath ? <PublicProfilePage slug={decodeURIComponent(publicPath[1])} /> : <App /> }
