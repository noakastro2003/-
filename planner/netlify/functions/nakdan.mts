// Automatic niqqud through Dicta's Nakdan (dicta.org.il, a non-profit).
// The phone sends plain Hebrew; we pass it to Dicta and return the vocalised text.
// Signed-in teachers only, and short texts only, so the service isn't abused through us.
import { getUser } from '@netlify/identity'
import type { Config } from '@netlify/functions'

const ENDPOINTS = [
  'https://nakdan-5-1.loadbalancer.dicta.org.il/addnikud',
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
  // sanity check: the same Hebrew letters as what was sent, only with vowels added
  const bare = (s: string) => s.replace(/[^\u05D0-\u05EA]/g, '')
  return out && bare(out) === bare(original) ? out : null
}

export default async (req: Request) => {
  const user = await getUser()
  if (!user) return json({ error: 'login' }, 401)
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const { text } = (await req.json().catch(() => ({}))) as { text?: string }
  const t = String(text || '').slice(0, 4000)
  if (!t.trim()) return json({ error: 'empty' }, 400)
  const body = JSON.stringify({
    task: 'nakdan', data: t, genre: 'modern', addmorph: true, keepnikud: true, keepmetagim: true, keepqq: false,
    nodageshdefmem: false, patachma: false, fixmultidagesh: true, matchpartial: true, useTokenization: true,
  })
  for (const url of ENDPOINTS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json;charset=UTF-8' }, body, signal: AbortSignal.timeout(15000) })
      if (!r.ok) { console.warn('nakdan', url, r.status); continue }
      const out = vocalise(await r.json(), t)
      if (out) return json({ text: out })
    } catch (e) { console.warn('nakdan failed', url, String(e)) }
  }
  return json({ error: 'unavailable' }, 502)
}

export const config: Config = { path: '/api/nakdan' }
