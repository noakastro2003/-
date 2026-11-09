// Friend teachers: each teacher gets a short personal code. Two teachers who add each
// other's code become friends and can send each other lessons and weeks, and can browse
// the lessons a friend chose to share with all her friends. Everything needs a login.
import { getUser } from '@netlify/identity'
import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'

type Profile = { id: string; name: string; email: string; code: string; school?: string; subjects?: string }
type Item = { id: string; kind: 'lesson' | 'week'; title: string; from: string; fromName: string; at: string; data: unknown }

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const newCode = () => Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('')
const json = (x: unknown, status = 200) => Response.json(x, { status, headers: { 'cache-control': 'no-store' } })
const MAX_ITEM = 400_000

export default async (req: Request) => {
  const user = await getUser()
  if (!user) return new Response('unauthorized', { status: 401 })
  const st = getStore({ name: 'hakita-social', consistency: 'strong' })
  const u = new URL(req.url)
  const op = u.searchParams.get('op') || ''

  async function profile(): Promise<Profile> {
    let p = (await st.get(`profile/${user!.id}`, { type: 'json' })) as Profile | null
    if (!p) {
      let code = newCode()
      while (await st.get(`code/${code}`)) code = newCode()
      p = { id: user!.id, name: (user as any).name || (user as any).user_metadata?.full_name || '', email: user!.email || '', code }
      await st.set(`code/${code}`, user!.id)
      await st.setJSON(`profile/${user!.id}`, p)
    }
    return p
  }
  const list = async (k: string) => ((await st.get(k, { type: 'json' })) as any[] | null) || []
  const pub = (p: Profile) => ({ id: p.id, name: p.name, code: p.code, school: p.school || '', subjects: p.subjects || '' })

  const me = await profile()
  let body: any = {}
  if (req.method === 'POST') { try { body = await req.json() } catch { return json({ error: 'bad json' }, 400) } }

  // who am I + my friends + my inbox
  if (op === 'me') {
    const ids: string[] = await list(`friends/${me.id}`)
    const friends = (await Promise.all(ids.map(id => st.get(`profile/${id}`, { type: 'json' })))).filter(Boolean).map(p => pub(p as Profile))
    const inbox: Item[] = await list(`inbox/${me.id}`)
    const requests = await list(`req/${me.id}`)
    return json({ me: pub(me), friends, requests, inbox: inbox.map(({ data, ...rest }) => ({ ...rest, size: JSON.stringify(data).length })) })
  }
  if (op === 'profile' && req.method === 'POST') {
    me.name = String(body.name || me.name).slice(0, 60); me.school = String(body.school || '').slice(0, 60); me.subjects = String(body.subjects || '').slice(0, 80)
    await st.setJSON(`profile/${me.id}`, me); return json({ me: pub(me) })
  }
  const befriend = async (a: string, b: string) => { for (const [x, y] of [[a, b], [b, a]]) { const l: string[] = await list(`friends/${x}`); if (!l.includes(y)) { l.push(y); await st.setJSON(`friends/${x}`, l) } } }
  // asking by code sends a friend request; the other teacher approves it (or it was already asked the other way)
  if (op === 'add' && req.method === 'POST') {
    const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const id = (await st.get(`code/${code}`)) as string | null
    if (!id) return json({ error: 'no-such-code' }, 404)
    if (id === me.id) return json({ error: 'self' }, 400)
    const p = (await st.get(`profile/${id}`, { type: 'json' })) as Profile
    const mine: any[] = await list(`req/${me.id}`)
    if (mine.some(r => r.id === id)) { await befriend(me.id, id); await st.setJSON(`req/${me.id}`, mine.filter(r => r.id !== id)); return json({ friend: pub(p) }) }
    if ((await list(`friends/${me.id}`)).includes(id)) return json({ friend: pub(p) })
    const theirs: any[] = await list(`req/${id}`)
    if (!theirs.some(r => r.id === me.id)) { theirs.unshift({ id: me.id, name: me.name, school: me.school || '', at: new Date().toISOString() }); await st.setJSON(`req/${id}`, theirs.slice(0, 50)) }
    return json({ pending: true, friend: pub(p) })
  }
  if ((op === 'accept' || op === 'decline') && req.method === 'POST') {
    const mine: any[] = await list(`req/${me.id}`)
    if (!mine.some(r => r.id === body.id)) return json({ error: 'no-request' }, 404)
    if (op === 'accept') await befriend(me.id, body.id)
    await st.setJSON(`req/${me.id}`, mine.filter(r => r.id !== body.id))
    return json({ ok: true })
  }
  if (op === 'remove' && req.method === 'POST') {
    for (const [a, b] of [[me.id, body.id], [body.id, me.id]]) { const l: string[] = await list(`friends/${a}`); await st.setJSON(`friends/${a}`, l.filter(x => x !== b)) }
    return json({ ok: true })
  }
  const isFriend = async (id: string) => (await list(`friends/${me.id}`)).includes(id)
  // send a lesson or a week to one friend
  if (op === 'send' && req.method === 'POST') {
    const to: string[] = Array.isArray(body.to) ? body.to : [body.to]
    const s = JSON.stringify(body.data || null)
    if (s.length > MAX_ITEM) return json({ error: 'too-big' }, 413)
    const item: Item = { id: crypto.randomUUID(), kind: body.kind === 'week' ? 'week' : 'lesson', title: String(body.title || '').slice(0, 120), from: me.id, fromName: me.name, at: new Date().toISOString(), data: body.data }
    let sent = 0
    for (const id of to) { if (!(await isFriend(id))) continue; const l: Item[] = await list(`inbox/${id}`); l.unshift(item); await st.setJSON(`inbox/${id}`, l.slice(0, 80)); sent++ }
    return json({ sent })
  }
  if (op === 'inbox-get') { const l: Item[] = await list(`inbox/${me.id}`); return json({ item: l.find(x => x.id === u.searchParams.get('id')) || null }) }
  if (op === 'inbox-del' && req.method === 'POST') { const l: Item[] = await list(`inbox/${me.id}`); await st.setJSON(`inbox/${me.id}`, l.filter(x => x.id !== body.id)); return json({ ok: true }) }
  // my lessons shared with all my friends
  if (op === 'publish' && req.method === 'POST') {
    const l: Item[] = await list(`lib/${me.id}`)
    const s = JSON.stringify(body.data || null)
    if (s.length > MAX_ITEM) return json({ error: 'too-big' }, 413)
    l.unshift({ id: crypto.randomUUID(), kind: 'lesson', title: String(body.title || '').slice(0, 120), from: me.id, fromName: me.name, at: new Date().toISOString(), data: body.data })
    await st.setJSON(`lib/${me.id}`, l.slice(0, 200)); return json({ ok: true })
  }
  if (op === 'unpublish' && req.method === 'POST') { const l: Item[] = await list(`lib/${me.id}`); await st.setJSON(`lib/${me.id}`, l.filter(x => x.id !== body.id)); return json({ ok: true }) }
  if (op === 'library') {
    const id = u.searchParams.get('id') || me.id
    if (id !== me.id && !(await isFriend(id))) return json({ error: 'not-friend' }, 403)
    return json({ items: await list(`lib/${id}`) })
  }
  return json({ error: 'unknown op' }, 400)
}

export const config: Config = { path: '/api/social' }
