// Classroom screen <-> teacher's phone.
// The classroom computer opens /cast and shows a short code; the phone types it in.
// This function only passes the WebRTC handshake (offer/answer) between them, after
// which they talk directly. If a direct link can't be made (strict school network),
// it also relays the screen state as a fallback. Codes expire after 12 hours.
import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'

const CODE = /^[A-Z2-9]{5}$/
const TTL = 12 * 3600e3
const json = (x: unknown, status = 200) => Response.json(x, { status, headers: { 'cache-control': 'no-store' } })
type Rec = { at: number; offer?: unknown; answer?: unknown; state?: { at: number; msg: unknown } }

export default async (req: Request) => {
  const u = new URL(req.url)
  const op = u.searchParams.get('op') || ''
  const code = String(u.searchParams.get('code') || '').toUpperCase()
  if (!CODE.test(code)) return json({ error: 'bad-code' }, 400)
  const st = getStore({ name: 'hakita-cast', consistency: 'strong' })
  const key = `c/${code}`
  const get = async () => { const r = (await st.get(key, { type: 'json' })) as Rec | null; return r && Date.now() - r.at < TTL ? r : null }
  let body: any = null
  if (req.method === 'POST') {
    const raw = await req.text()
    if (raw.length > 60_000) return json({ error: 'too-big' }, 413)
    try { body = JSON.parse(raw) } catch { return json({ error: 'bad-json' }, 400) }
  }

  // the classroom screen registers a fresh code with its offer
  if (op === 'offer' && body) {
    if (await get()) return json({ error: 'taken' }, 409)
    await st.setJSON(key, { at: Date.now(), offer: body.sdp } as Rec)
    return json({ ok: true })
  }
  const rec = await get()
  if (!rec) return json({ error: 'no-such-code' }, 404)
  if (op === 'getoffer') return json({ sdp: rec.offer || null })
  if (op === 'answer' && body) { rec.answer = body.sdp; await st.setJSON(key, rec); return json({ ok: true }) }
  if (op === 'getanswer') return json({ sdp: rec.answer || null })
  // fallback relay
  if (op === 'state' && body) { rec.state = { at: Date.now(), msg: body.msg }; await st.setJSON(key, rec); return json({ ok: true }) }
  if (op === 'getstate') { const since = Number(u.searchParams.get('since') || 0); return json(rec.state && rec.state.at > since ? rec.state : { at: since }) }
  if (op === 'end') { await st.delete(key); return json({ ok: true }) }
  return json({ error: 'unknown op' }, 400)
}

export const config: Config = { path: '/api/cast' }
