const KEY = 'admin-hub:v1'

// Seeded only the first time the app runs on a device.
const SEED = [
  { id: 'seed-portfolio', name: 'Portfolio Admin', url: 'https://edisontaimu.online/admin/login', group: 'Websites', note: '' },
  { id: 'seed-chakudya', name: 'Chakudya Admin', url: 'https://chakudya.xyz/admin/', group: 'APIs', note: '' },
]

export function loadLinks() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return SEED
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : SEED
  } catch {
    return SEED
  }
}

export function saveLinks(links) {
  try {
    localStorage.setItem(KEY, JSON.stringify(links))
  } catch {
    // Storage can be unavailable (private mode); the app still works for this session.
  }
}

// Returns a clean https/http URL string, or null if it is not valid.
export function normalizeUrl(input) {
  const value = input.trim()
  if (!value) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null
    return u.toString()
  } catch {
    return null
  }
}

export function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// Validates an imported file and returns only well-formed links.
export function sanitizeImport(data) {
  if (!Array.isArray(data)) return null
  const out = []
  for (const item of data) {
    if (!item || typeof item !== 'object') continue
    const url = normalizeUrl(String(item.url ?? ''))
    const name = String(item.name ?? '').trim()
    if (!url || !name) continue
    out.push({
      id: typeof item.id === 'string' && item.id ? item.id : newId(),
      name: name.slice(0, 60),
      url,
      group: String(item.group ?? '').trim().slice(0, 40),
      note: String(item.note ?? '').trim().slice(0, 140),
    })
  }
  return out
}
