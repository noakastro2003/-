// Runs every 5 minutes: sends the reminders whose time has come.
// The app builds the list of upcoming reminders (notifQueue) and syncs it.
import { getStore } from '@netlify/blobs'
import webpush from 'web-push'
import type { Config } from '@netlify/functions'

export default async () => {
  webpush.setVapidDetails('https://noa-hakita.netlify.app', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
  const store = getStore({ name: 'hakita', consistency: 'strong' })
  const { blobs } = await store.list({ prefix: 'push/' })
  const now = Date.now()
  for (const b of blobs) {
    const uid = b.key.slice(5)
    const rec = (await store.get(b.key, { type: 'json' })) as { subs: any[]; last: number } | null
    if (!rec || !rec.subs.length) continue
    const user = (await store.get(`user/${uid}`, { type: 'json' })) as { data?: { notifQueue?: { at: number; title: string; body: string; tag?: string }[] } } | null
    const queue = (user && user.data && user.data.notifQueue) || []
    const due = queue.filter(n => n.at > rec.last && n.at <= now && now - n.at < 30 * 60 * 1000)
    for (const n of due) {
      for (const s of rec.subs.slice()) {
        try { await webpush.sendNotification(s, JSON.stringify(n)) }
        catch (e) { const code = (e as any).statusCode; if (code === 404 || code === 410) rec.subs = rec.subs.filter(x => x !== s) }
      }
    }
    rec.last = now
    await store.setJSON(b.key, rec)
  }
}

export const config: Config = { schedule: '*/5 * * * *' }
