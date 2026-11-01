// Keeps the app's data in sync between devices. Only the logged-in user can
// read or write their own record (Netlify Identity + Netlify Blobs).
import { getUser } from '@netlify/identity'
import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'

export default async (req: Request) => {
  const user = await getUser()
  if (!user) return new Response('unauthorized', { status: 401 })
  const store = getStore({ name: 'hakita', consistency: 'strong' })
  const key = `user/${user.id}`

  if (req.method === 'GET') {
    const rec = (await store.get(key, { type: 'json' })) || { data: {}, v: 0 }
    return Response.json(rec, { headers: { 'cache-control': 'no-store' } })
  }

  if (req.method === 'PUT') {
    let body: { patch?: Record<string, unknown> }
    try { body = await req.json() } catch { return new Response('bad json', { status: 400 }) }
    if (!body || typeof body.patch !== 'object' || Array.isArray(body.patch)) return new Response('bad body', { status: 400 })
    const rec = ((await store.get(key, { type: 'json' })) as { data: Record<string, unknown>; v: number } | null) || { data: {}, v: 0 }
    Object.assign(rec.data, body.patch)
    rec.v = (rec.v || 0) + 1
    const at = new Date().toISOString()
    await store.setJSON(key, { ...rec, at })
    return Response.json({ v: rec.v, at }, { headers: { 'cache-control': 'no-store' } })
  }

  return new Response('method not allowed', { status: 405 })
}

export const config: Config = { path: '/api/sync' }
