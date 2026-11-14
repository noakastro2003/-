// Automatic niqqud through Dicta's Nakdan (dicta.org.il, a non-profit).
// The phone sends plain Hebrew; we pass it to Dicta and return the vocalised text.
// Signed-in teachers only, and short texts only, so the service isn't abused through us.
import { getUser } from '@netlify/identity'
import type { Config } from '@netlify/functions'

// the address that works today first (see github.com/moshejs/dicta-nakdan); the others as spares
const ENDPOINTS = [
  'https://nakdan-2-0.loadbalancer.dicta.org.il/api',
  'https://nakdan-u1-0.loadbalancer.dicta.org.il/api',
]
const json = (x: unknown, status = 200) => Response.json(x, { status, headers: { 'cache-control': 'no-store' } })

// Dicta has answered in a few shapes over the years; read whichever comes back
function vocalise(resp: any, original: string): string | null {
  const toks: any[] = Array.isArray(resp) ? resp : Array.isArray(resp?.data) ? resp.data : null
  if (!toks) return typeof resp?.text === 'string' ? resp.text : null
  let out = ''
  for (const t of toks) {
    const word = t.word ?? t.str ?? ''
    if (t.sep) { out += word; continue }
    const opts = t.options ?? t.nakdan?.options ?? []
    const first = opts[0]
    let w = typeof first === 'string' ? first : Array.isArray(first) ? first[0] : first?.w ?? first?.word
    if (typeof w !== 'string' || !w) w = word
    out += w.replace(/\|/g, '')
  }
  // must contain at least one vowel mark, or it isn't a niqqud result
  return out && /[\u05B0-\u05BC\u05C1\u05C2\u05C7]/.test(out) ? out : null
}

export default async (req: Request) => {
  const user = await getUser()
  if (!user) return json({ error: 'login' }, 401)
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const { text } = (await req.json().catch(() => ({}))) as { text?: string }
  const t = String(text || '').slice(0, 4000)
  if (!t.trim()) return json({ error: 'empty' }, 400)
  const body = JSON.stringify({ task: 'nakdan', genre: 'modern', data: t, addmorph: false, keepqq: false })
  let last = ''
  for (const url of ENDPOINTS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body, signal: AbortSignal.timeout(20000) })
      const raw = await r.text()
      if (!r.ok) { last = `${r.status} ${raw.slice(0, 200)}`; console.warn('nakdan', url, last); continue }
      let data: unknown = null
      try { data = JSON.parse(raw) } catch { last = 'not json: ' + raw.slice(0, 120); continue }
      const out = vocalise(data, t)
      if (out) return json({ text: out })
      last = 'unexpected shape: ' + raw.slice(0, 160)
    } catch (e) { last = String(e); console.warn('nakdan failed', url, last) }
  }
  // say what went wrong, so it can be fixed without guessing
  return json({ error: 'unavailable', detail: last.slice(0, 300) }, 502)
}

export const config: Config = { path: '/api/nakdan' }
