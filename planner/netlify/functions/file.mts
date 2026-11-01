// Stores uploaded lesson files (in 4MB parts) for the logged-in user only.
import { getUser } from '@netlify/identity'
import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'

export default async (req: Request) => {
  const user = await getUser()
  if (!user) return new Response('unauthorized', { status: 401 })
  const u = new URL(req.url)
  const id = u.searchParams.get('id') || ''
  const part = Number(u.searchParams.get('part') || 0)
  if (!/^[a-z0-9]{6,24}$/.test(id) || !Number.isInteger(part) || part < 0 || part > 200) return new Response('bad id', { status: 400 })
  const store = getStore({ name: 'hakita-files', consistency: 'strong' })
  const key = `${user.id}/${id}/${part}`

  if (req.method === 'PUT') {
    const buf = await req.arrayBuffer()
    if (buf.byteLength > 4.5 * 1024 * 1024) return new Response('too big', { status: 413 })
    await store.set(key, buf)
    return Response.json({ ok: true })
  }
  if (req.method === 'GET') {
    const buf = await store.get(key, { type: 'arrayBuffer' })
    if (!buf) return new Response('not found', { status: 404 })
    return new Response(buf, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'private, max-age=31536000' } })
  }
  if (req.method === 'DELETE') {
    const { blobs } = await store.list({ prefix: `${user.id}/${id}/` })
    await Promise.all(blobs.map(b => store.delete(b.key)))
    return Response.json({ ok: true })
  }
  return new Response('method not allowed', { status: 405 })
}

export const config: Config = { path: '/api/file' }
