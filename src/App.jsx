import { useEffect, useMemo, useRef, useState } from 'react'
import { loadLinks, saveLinks, normalizeUrl, newId, sanitizeImport } from './storage.js'

const COLORS = ['#2fbfa4', '#5b8def', '#e0795b', '#b073e6', '#e3b341', '#4cb3d4', '#d9648f']

function colorFor(name) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COLORS[h % COLORS.length]
}

const DISMISS_KEY = 'admin-hub:install-dismissed'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function hostOf(url) {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function originOf(url) {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

function SiteIcon({ link }) {
  const [loaded, setLoaded] = useState(false)
  const letter = (link.name.trim()[0] || '?').toUpperCase()
  // The letter is always drawn; the site's own icon fades in over it only if it loads.
  return (
    <span className="icon" style={{ background: colorFor(link.name) }} aria-hidden="true">
      {letter}
      <img
        className={loaded ? 'loaded' : ''}
        src={`${originOf(link.url)}/favicon.ico`}
        alt=""
        loading="lazy"
        onLoad={(e) => setLoaded(e.currentTarget.naturalWidth >= 16)}
        onError={() => setLoaded(false)}
      />
    </span>
  )
}

function LinkForm({ initial, groups, onSave, onDelete, onClose }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [group, setGroup] = useState(initial?.group ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState('')

  function submit(e) {
    e.preventDefault()
    const cleanUrl = normalizeUrl(url)
    if (!name.trim()) return setError('Give this panel a name.')
    if (!cleanUrl) return setError('Enter a valid web address, for example example.com/admin')
    onSave({
      id: initial?.id ?? newId(),
      name: name.trim(),
      url: cleanUrl,
      group: group.trim(),
      note: note.trim(),
    })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{initial ? 'Edit panel' : 'Add admin panel'}</h2>

        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Portfolio Admin" maxLength={60} autoFocus />
        </label>
        <label>
          Link
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="example.com/admin" inputMode="url" autoCapitalize="none" autoCorrect="off" />
        </label>
        <label>
          Group <span className="optional">(optional)</span>
          <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Websites" list="group-list" maxLength={40} />
          <datalist id="group-list">
            {groups.map((g) => <option key={g} value={g} />)}
          </datalist>
        </label>
        <label>
          Note <span className="optional">(optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What this panel manages" maxLength={140} />
        </label>

        {error && <p className="error" role="alert">{error}</p>}

        <div className="sheet-actions">
          {initial && (
            <button type="button" className="btn danger" onClick={() => onDelete(initial)}>Delete</button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Save</button>
        </div>
      </form>
    </div>
  )
}

export default function App() {
  const [links, setLinks] = useState(loadLinks)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | link object
  const [menuOpen, setMenuOpen] = useState(false)
  const [installEvent, setInstallEvent] = useState(() => window.__installEvent ?? null)
  const [installed, setInstalled] = useState(() => isStandalone())
  const [dismissed, setDismissed] = useState(readDismissed)
  const [toast, setToast] = useState('')
  const fileRef = useRef(null)

  useEffect(() => saveLinks(links), [links])

  useEffect(() => {
    const onReady = () => setInstallEvent(window.__installEvent ?? null)
    const onInstalled = () => {
      window.__installEvent = null
      setInstallEvent(null)
      setInstalled(true)
    }
    window.addEventListener('admin-hub:install-ready', onReady)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('admin-hub:install-ready', onReady)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const groups = useMemo(
    () => [...new Set(links.map((l) => l.group).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [links]
  )

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? links.filter((l) => [l.name, l.url, l.group, l.note].some((f) => f.toLowerCase().includes(q)))
      : links
    const map = new Map()
    for (const l of filtered) {
      const key = l.group || ''
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(l)
    }
    const named = [...map.keys()].filter(Boolean).sort((a, b) => a.localeCompare(b))
    const order = map.has('') ? [...named, ''] : named
    // With no groups at all, render one flat list without a heading.
    return order.map((key) => ({ key, title: key || (named.length ? 'Other' : ''), items: map.get(key) }))
  }, [links, query])

  function saveLink(link) {
    setLinks((prev) => {
      const exists = prev.some((l) => l.id === link.id)
      return exists ? prev.map((l) => (l.id === link.id ? link : l)) : [...prev, link]
    })
    setEditing(null)
    setToast('Saved')
  }

  function deleteLink(link) {
    if (!window.confirm(`Delete "${link.name}" from Admin Hub? This does not affect the site itself.`)) return
    setLinks((prev) => prev.filter((l) => l.id !== link.id))
    setEditing(null)
    setToast('Deleted')
  }

  async function install() {
    if (!installEvent) return
    installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    window.__installEvent = null
    setInstallEvent(null)
    if (outcome === 'accepted') setInstalled(true)
  }

  function dismissInstall() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore
    }
  }

  function exportLinks() {
    const blob = new Blob([JSON.stringify(links, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'admin-hub-links.json'
    a.click()
    URL.revokeObjectURL(a.href)
    setMenuOpen(false)
  }

  async function importLinks(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    setMenuOpen(false)
    if (!file) return
    try {
      const clean = sanitizeImport(JSON.parse(await file.text()))
      if (!clean || clean.length === 0) return setToast('No valid links found in that file')
      if (!window.confirm(`Replace your ${links.length} saved link(s) with ${clean.length} from the file?`)) return
      setLinks(clean)
      setToast('Imported')
    } catch {
      setToast('That file could not be read')
    }
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Admin Hub</h1>
          <p className="sub">{links.length} {links.length === 1 ? 'panel' : 'panels'}</p>
        </div>
        <div className="top-actions">
          <div className="menu-wrap">
            <button className="btn small icon-btn" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
            {menuOpen && (
              <div className="menu" role="menu">
                <button role="menuitem" onClick={exportLinks}>Export backup</button>
                <button role="menuitem" onClick={() => fileRef.current?.click()}>Import backup</button>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importLinks} />
        </div>
      </header>

      <input
        className="search"
        type="search"
        placeholder="Search panels"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search panels"
      />

      {!installed && !dismissed && (
        <div className="install-banner" role="region" aria-label="Install Admin Hub">
          <span className="install-badge" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></svg>
          </span>
          <div className="install-text">
            <strong>Install Admin Hub</strong>
            <span>
              {installEvent
                ? 'Open all your admin panels from your home screen, even offline.'
                : isIos()
                  ? 'Tap the Share button, then Add to Home Screen.'
                  : 'Open your browser menu, then tap Install app or Add to Home screen.'}
            </span>
          </div>
          <div className="install-actions">
            {installEvent && <button className="btn small primary" onClick={install}>Install</button>}
            <button className="btn small" onClick={dismissInstall}>Not now</button>
          </div>
        </div>
      )}

      <main>
        {links.length === 0 && (
          <div className="empty">
            <p>No admin panels yet.</p>
            <button className="btn primary" onClick={() => setEditing('new')}>Add your first panel</button>
          </div>
        )}

        {links.length > 0 && sections.length === 0 && <p className="empty">Nothing matches "{query}".</p>}

        {sections.map(({ key, title, items }) => (
          <section key={key || 'none'}>
            {title && <h2 className="group-title">{title}</h2>}
            <ul className="grid">
              {items.map((link) => (
                <li key={link.id} className="card">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="card-link">
                    <SiteIcon link={link} />
                    <span className="card-text">
                      <span className="card-name">{link.name}</span>
                      <span className="card-host">{hostOf(link.url)}</span>
                      {link.note && <span className="card-note">{link.note}</span>}
                    </span>
                  </a>
                  <button className="btn small icon-btn edit" aria-label={`Edit ${link.name}`} onClick={() => setEditing(link)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      <button className="fab" aria-label="Add admin panel" onClick={() => setEditing('new')}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </button>

      {editing && (
        <LinkForm
          initial={editing === 'new' ? null : editing}
          groups={groups}
          onSave={saveLink}
          onDelete={deleteLink}
          onClose={() => setEditing(null)}
        />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
