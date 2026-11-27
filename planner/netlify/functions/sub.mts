// A short-lived page (installable as its own little app) for a substitute teacher: one day's lessons,
// the teacher's notes, class rules and – only if the teacher chose so – the class list and seating.
// No grades, no journal, no parent details.
// The substitute can send back a day report (per lesson, absences, notes about kids) and chat with the teacher;
// both wake the teacher's phone with a push. Creating, ending, reading replies and writing as the teacher
// need the teacher's login; everything else needs only the unguessable token.
import { getUser } from '@netlify/identity'
import { getStore } from '@netlify/blobs'
import webpush from 'web-push'
import type { Config } from '@netlify/functions'

type Msg = { from: 't' | 's'; text: string; at: number }
type Report = { lessons: Record<string, { s: string; note: string }>; absent: string[]; late: string[]; notes: { kid: string; text: string }[]; summary: string; name: string; at: number }
type Rec = { owner: string; exp: number; data: any; msgs?: Msg[]; report?: Report | null; created?: number; pushAt?: number }

const json = (x: unknown, status = 200) => Response.json(x, { status, headers: { 'cache-control': 'no-store' } })
const MAX = 200_000
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 24)
const okTok = (t: string) => /^[a-z0-9]{16,40}$/.test(t)
const str = (x: unknown, n: number) => String(x ?? '').trim().slice(0, n)
const strs = (x: unknown, n: number, each = 60) => (Array.isArray(x) ? x : []).map(v => str(v, each)).filter(Boolean).slice(0, n)

function cleanReport(r: any, name: string): Report {
  const lessons: Report['lessons'] = {}
  for (const [k, v] of Object.entries(r && typeof r.lessons === 'object' ? r.lessons : {}).slice(0, 14)) {
    const s = ['done', 'part', 'skip'].includes((v as any)?.s) ? (v as any).s : ''
    const note = str((v as any)?.note, 600)
    if (s || note) lessons[str(k, 20)] = { s, note }
  }
  return {
    lessons, absent: strs(r?.absent, 60), late: strs(r?.late, 60),
    notes: (Array.isArray(r?.notes) ? r.notes : []).map((n: any) => ({ kid: str(n?.kid, 60), text: str(n?.text, 600) })).filter((n: any) => n.text).slice(0, 40),
    summary: str(r?.summary, 2000), name: str(name || r?.name, 40), at: Date.now(),
  }
}

// wake the teacher's phone(s); at most one push a minute per link so a chatty day doesn't buzz nonstop
async function wake(t: string, rec: Rec, title: string, body: string, force = false) {
  if (!process.env.VAPID_PRIVATE_KEY || (!force && Date.now() - (rec.pushAt || 0) < 60e3)) return
  rec.pushAt = Date.now()
  try {
    const app = getStore({ name: 'hakita', consistency: 'strong' })
    const p = (await app.get(`push/${rec.owner}`, { type: 'json' })) as { subs: any[] } | null
    if (!p || !p.subs.length) return
    webpush.setVapidDetails('https://classora.netlify.app', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
    const msg = JSON.stringify({ title, body: body.slice(0, 140), tag: 'sub-' + t, url: '/?subinbox=' + t })
    await Promise.all(p.subs.map(s => webpush.sendNotification(s, msg).catch(() => null)))
  } catch (e) { console.warn('sub push failed', e) }
}

export default async (req: Request) => {
  const u = new URL(req.url)
  const op = u.searchParams.get('op') || ''
  const st = getStore({ name: 'hakita-sub', consistency: 'strong' })
  const load = async (t: string) => {
    if (!okTok(t)) return null
    const rec = (await st.get(`s/${t}`, { type: 'json' })) as Rec | null
    if (!rec) return null
    if (Date.now() > rec.exp + 3 * 86400e3) { await st.delete(`s/${t}`); return null } // replies stay readable for the teacher 3 days
    return rec
  }

  // ---------- public, by token
  if (op === 'get' || op === 'manifest' || op === 'say' || op === 'report') {
    const t = String(u.searchParams.get('t') || '')
    const rec = await load(t)
    if (!rec || Date.now() > rec.exp) return json({ error: 'gone' }, 404)

    if (op === 'get') return json({ data: rec.data, exp: rec.exp, msgs: rec.msgs || [], report: rec.report || null })

    if (op === 'manifest') {
      const cls = str(rec.data?.cls, 30), teacher = str(rec.data?.teacher, 30)
      const name = teacher ? `הכיתה של ${teacher}` : cls ? `כיתה ${cls}` : 'מורה מחליפה'
      return new Response(JSON.stringify({
        name, short_name: name.slice(0, 18), description: 'כל מה שצריך להיום בכיתה', lang: 'he', dir: 'rtl',
        start_url: `/sub.html?t=${t}`, scope: '/sub.html', id: `/sub.html?t=${t}`, display: 'standalone',
        background_color: '#F6F0E8', theme_color: '#F6F0E8',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
      }), { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'no-store' } })
    }

    if (req.method !== 'POST') return json({ error: 'method' }, 405)
    const raw = await req.text()
    if (raw.length > 40_000) return json({ error: 'too-big' }, 413)
    let body: any = {}
    try { body = JSON.parse(raw) } catch { return json({ error: 'bad json' }, 400) }

    if (op === 'say') {
      const text = str(body.text, 1000)
      if (!text) return json({ error: 'empty' }, 400)
      const msgs = rec.msgs || []
      if (msgs.filter(m => m.from === 's').length >= 120) return json({ error: 'too-many' }, 429)
      msgs.push({ from: 's', text, at: Date.now() }); rec.msgs = msgs
      const who = str(body.name, 40) || 'המחליפה'
      await wake(t, rec, `💬 הודעה מ${who}`, text)
      await st.setJSON(`s/${t}`, rec)
      return json({ ok: true, msgs })
    }
    if (op === 'report') {
      rec.report = cleanReport(body.report, body.name)
      const r = rec.report, n = Object.keys(r.lessons).length
      const bits = [n ? `${n} שיעורים עודכנו` : '', r.absent.length ? `חסרים: ${r.absent.join(', ')}` : '', r.summary ? r.summary : ''].filter(Boolean)
      if (body.final) await wake(t, rec, `📋 ${r.name || 'המחליפה'} ${body.final ? 'סיכמה את היום' : 'עדכנה'}`, bits.join(' · ') || 'יש עדכון מהכיתה', !!body.final)
      await st.setJSON(`s/${t}`, rec)
      return json({ ok: true, report: rec.report })
    }
  }

  // ---------- the teacher
  const user = await getUser()
  if (!user) return json({ error: 'login' }, 401)

  if (op === 'mine') {
    const list = ((await st.get(`own/${user.id}`, { type: 'json' })) as string[] | null) || []
    const out = [], keep = []
    for (const t of list) {
      const rec = await load(t)
      if (!rec || rec.owner !== user.id) continue
      keep.push(t)
      out.push({ token: t, exp: rec.exp, created: rec.created || 0, day: rec.data?.day || '', cls: rec.data?.cls || '', periods: (rec.data?.periods || []).map((p: any) => ({ start: p.start, title: p.title })), msgs: rec.msgs || [], report: rec.report || null })
    }
    if (keep.length !== list.length) await st.setJSON(`own/${user.id}`, keep)
    return json({ items: out })
  }

  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const raw = await req.text()
  if (raw.length > MAX) return json({ error: 'too-big' }, 413)
  let body: any = {}
  try { body = JSON.parse(raw) } catch { return json({ error: 'bad json' }, 400) }

  if (op === 'create') {
    const hours = Math.max(1, Math.min(24 * 7, Number(body.hours) || 24))
    const t = token()
    await st.setJSON(`s/${t}`, { owner: user.id, exp: Date.now() + hours * 3600e3, data: body.data, msgs: [], report: null, created: Date.now() })
    const mine = ((await st.get(`own/${user.id}`, { type: 'json' })) as string[] | null) || []
    await st.setJSON(`own/${user.id}`, [t, ...mine].slice(0, 30))
    return json({ token: t, exp: Date.now() + hours * 3600e3 })
  }
  const t = String(body.token || '')
  const rec = await load(t)
  if (!rec || rec.owner !== user.id) return json({ error: 'gone' }, 404)
  if (op === 'end') { await st.delete(`s/${t}`); return json({ ok: true }) }
  if (op === 'tsay') {
    const text = str(body.text, 1000)
    if (!text) return json({ error: 'empty' }, 400)
    const msgs = rec.msgs || []
    msgs.push({ from: 't', text, at: Date.now() }); rec.msgs = msgs.slice(-300)
    await st.setJSON(`s/${t}`, rec)
    return json({ ok: true, msgs: rec.msgs })
  }
  if (op === 'update') { // the teacher changes today's notes while the link is live
    if (typeof body.notes === 'string') rec.data.notes = str(body.notes, 4000)
    await st.setJSON(`s/${t}`, rec)
    return json({ ok: true })
  }
  return json({ error: 'unknown op' }, 400)
}

export const config: Config = { path: '/api/sub' }
