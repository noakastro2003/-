// Saves this phone's push subscription, removes it, or sends a test notification.
import { getUser } from '@netlify/identity'
import { getStore } from '@netlify/blobs'
import webpush from 'web-push'
import type { Config } from '@netlify/functions'

export default async (req: Request) => {
  const user = await getUser()
  if (!user) return new Response('unauthorized', { status: 401 })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const store = getStore({ name: 'hakita', consistency: 'strong' })
  const key = `push/${user.id}`
  const body = await req.json().catch(() => ({}))
  const rec = ((await store.get(key, { type: 'json' })) as { subs: any[]; last: number } | null) || { subs: [], last: Date.now() }

  if (body.action === 'subscribe' && body.sub && typeof body.sub.endpoint === 'string') {
    rec.subs = rec.subs.filter(s => s.endpoint !== body.sub.endpoint).concat([body.sub]).slice(-5)
    await store.setJSON(key, rec)
    return Response.json({ ok: true, devices: rec.subs.length })
  }
  if (body.action === 'unsubscribe' && body.endpoint) {
    rec.subs = rec.subs.filter(s => s.endpoint !== body.endpoint)
    await store.setJSON(key, rec)
    return Response.json({ ok: true })
  }
  if (body.action === 'test') {
    webpush.setVapidDetails('https://noa-hakita.netlify.app', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
    let sent = 0
    for (const s of rec.subs) {
      try { await webpush.sendNotification(s, JSON.stringify({ title: 'הכיתה שלי 💜', body: 'ההתראות עובדות! ככה ייראו התזכורות שלך.', tag: 'test' })); sent++ } catch (e) { console.warn('push failed', (e as any).statusCode) }
    }
    return Response.json({ ok: sent > 0, sent })
  }
  return new Response('bad request', { status: 400 })
}

export const config: Config = { path: '/api/push' }
