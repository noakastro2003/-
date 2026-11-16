// A short-lived, read-only page for a substitute teacher: one day's lessons, the teacher's notes,
// and – only if the teacher chose so – the class list and seating. No grades, no journal, no parent details.
// Creating and ending a link needs the teacher's login; reading needs only the unguessable token.
import { getUser } from '@netlify/identity'
import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'

const json = (x: unknown, status = 200) => Response.json(x, { status, headers: { 'cache-control': 'no-store' } })
const MAX = 200_000
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 24)

export default async (req: Request) => {
  const u = new URL(req.url)
  const op = u.searchParams.get('op') || ''
  const st = getStore({ name: 'hakita-sub', consistency: 'strong' })

  if (op === 'get') {
    const t = String(u.searchParams.get('t') || '')
    if (!/^[a-z0-9]{16,40}$/.test(t)) return json({ error: 'bad' }, 400)
    const rec = (await st.get(`s/${t}`, { type: 'json' })) as { exp: number; data: unknown } | null
    if (!rec || Date.now() > rec.exp) { if (rec) await st.delete(`s/${t}`); return json({ error: 'gone' }, 404) }
    return json({ data: rec.data, exp: rec.exp })
  }

  const user = await getUser()
  if (!user) return json({ error: 'login' }, 401)
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const raw = await req.text()
  if (raw.length > MAX) return json({ error: 'too-big' }, 413)
  let body: any = {}
  try { body = JSON.parse(raw) } catch { return json({ error: 'bad json' }, 400) }

  if (op === 'create') {
    const hours = Math.max(1, Math.min(24 * 7, Number(body.hours) || 24))
    const t = token()
    await st.setJSON(`s/${t}`, { owner: user.id, exp: Date.now() + hours * 3600e3, data: body.data })
    const mine = ((await st.get(`own/${user.id}`, { type: 'json' })) as string[] | null) || []
    await st.setJSON(`own/${user.id}`, [t, ...mine].slice(0, 30))
    return json({ token: t, exp: Date.now() + hours * 3600e3 })
  }
  if (op === 'end') {
    const t = String(body.token || '')
    const rec = (await st.get(`s/${t}`, { type: 'json' })) as { owner: string } | null
    if (rec && rec.owner === user.id) await st.delete(`s/${t}`)
    return json({ ok: true })
  }
  return json({ error: 'unknown op' }, 400)
}

export const config: Config = { path: '/api/sub' }
