// Problem reports: any signed-in teacher can send one; only the app owner can read them.
// The owner is recognised by the SHA-256 of her login email (env ADMIN_EMAIL_SHA256),
// so the address itself never sits in the code. New reports wake her phone with a push.
import { getUser } from '@netlify/identity'
import { getStore } from '@netlify/blobs'
import webpush from 'web-push'
import type { Config } from '@netlify/functions'

type Report = { id: string; at: string; from: string; name: string; email: string; text: string; meta: string; shot?: boolean; done?: boolean }
const json = (x: unknown, status = 200) => Response.json(x, { status, headers: { 'cache-control': 'no-store' } })
const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s.trim().toLowerCase())))].map(b => b.toString(16).padStart(2, '0')).join('')

export default async (req: Request) => {
  const user = await getUser()
  if (!user) return new Response('unauthorized', { status: 401 })
  const st = getStore({ name: 'hakita-reports', consistency: 'strong' })
  const op = new URL(req.url).searchParams.get('op') || ''
  const isAdmin = !!process.env.ADMIN_EMAIL_SHA256 && (await sha(user.email || '')) === process.env.ADMIN_EMAIL_SHA256
  if (isAdmin) await st.set('admin-id', user.id) // so new reports know whose phone to wake
  const list = async () => ((await st.get('list', { type: 'json' })) as Report[] | null) || []

  if (op === 'me') return json({ admin: isAdmin, open: isAdmin ? (await list()).filter(r => !r.done).length : 0 })

  if (op === 'send' && req.method === 'POST') {
    const body = await req.json().catch(() => null) as { text?: string; meta?: string; shot?: string } | null
    if (!body || !String(body.text || '').trim()) return json({ error: 'empty' }, 400)
    // a little spam guard: at most 10 reports a day from one teacher
    const day = new Date().toISOString().slice(0, 10), ck = `rate/${user.id}/${day}`
    const n = Number(await st.get(ck) || 0); if (n >= 10) return json({ error: 'too-many' }, 429)
    await st.set(ck, String(n + 1))
    const r: Report = {
      id: crypto.randomUUID(), at: new Date().toISOString(), from: user.id,
      name: String((user as any).name || (user as any).user_metadata?.full_name || '').slice(0, 60), email: user.email || '',
      text: String(body.text).slice(0, 3000), meta: String(body.meta || '').slice(0, 600),
    }
    if (typeof body.shot === 'string' && body.shot.startsWith('data:image/') && body.shot.length < 2_500_000) { await st.set(`shot/${r.id}`, body.shot); r.shot = true }
    const l = await list(); l.unshift(r); await st.setJSON('list', l.slice(0, 300))
    // wake the owner's phone
    try {
      const adminId = await st.get('admin-id') as string | null
      const app = getStore({ name: 'hakita', consistency: 'strong' })
      const rec = adminId ? (await app.get(`push/${adminId}`, { type: 'json' })) as { subs: any[] } | null : null
      if (rec && rec.subs.length && process.env.VAPID_PRIVATE_KEY) {
        webpush.setVapidDetails('https://noa-hakita.netlify.app', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
        const msg = JSON.stringify({ title: `🐞 דיווח חדש${r.name ? ' מ' + r.name : ''}`, body: r.text.slice(0, 140), tag: 'report-' + r.id, url: '/?go=reports' })
        await Promise.all(rec.subs.map(s => webpush.sendNotification(s, msg).catch(() => null)))
      }
    } catch (e) { console.warn('report push failed', e) }
    return json({ ok: true })
  }

  if (!isAdmin) return json({ error: 'forbidden' }, 403)
  if (op === 'list') return json({ items: await list() })
  if (op === 'shot') return json({ shot: (await st.get(`shot/${new URL(req.url).searchParams.get('id')}`)) || null })
  if ((op === 'done' || op === 'del') && req.method === 'POST') {
    const { id } = await req.json().catch(() => ({})) as { id?: string }
    let l = await list()
    if (op === 'done') l = l.map(r => r.id === id ? { ...r, done: !r.done } : r)
    else { l = l.filter(r => r.id !== id); await st.delete(`shot/${id}`) }
    await st.setJSON('list', l); return json({ ok: true })
  }
  return json({ error: 'unknown op' }, 400)
}

export const config: Config = { path: '/api/report' }
