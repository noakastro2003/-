// The AI helper's front door: starts a job (a lesson or a worksheet) and lets the app check on it.
// The work itself runs in ai-run (a background function, up to 15 minutes), so Claude can think properly.
// A short comment polish runs right here. Signed-in teachers only, with a daily cap per teacher and a monthly cap for the site.
import Anthropic from '@anthropic-ai/sdk'
import { getUser } from '@netlify/identity'
import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'
import { SYSTEM } from '../lib/ai-prompts.mts'

const json = (x: unknown, status = 200) => Response.json(x, { status, headers: { 'cache-control': 'no-store' } })
const DAY_CAP = Number(Netlify.env.get('AI_DAY_CAP') || 3)
const MONTH_CAP = Number(Netlify.env.get('AI_MONTH_CAP') || 4) // AI is paid from the site's Netlify credits: keep the default small; raise it with the AI_MONTH_CAP variable
// the site's owner has no caps: her sign-in email(s) live in the AI_OWNER_EMAILS variable (comma separated), never in the code
const OWNERS = String(Netlify.env.get('AI_OWNER_EMAILS') || '').toLowerCase().split(/[,\s]+/).filter(Boolean)

export default async (req: Request) => {
  const user = await getUser()
  if (!user) return json({ error: 'login' }, 401)
  if (!Netlify.env.get('ANTHROPIC_API_KEY')) return json({ error: 'not-ready' }, 503)
  const u = new URL(req.url), op = u.searchParams.get('op') || ''
  const st = getStore({ name: 'hakita-ai', consistency: 'strong' })

  if (op === 'get') {
    const job = (await st.get(`job/${u.searchParams.get('id')}`, { type: 'json' })) as any
    if (!job || job.owner !== user.id) return json({ error: 'gone' }, 404)
    return json({ status: job.status, result: job.result || null, error: job.error || null, diag: job.status === 'error' ? job.diag || null : null })
  }
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const b = (await req.json().catch(() => ({}))) as any

  // limits: per teacher per day, and for the whole site per month (AI is paid from the site's credits)
  const day = new Date().toISOString().slice(0, 10), month = day.slice(0, 7)
  const dk = `n/${user.id}/${day}`, mk = `m/${month}`
  const usedDay = Number((await st.get(dk)) || 0), usedMonth = Number((await st.get(mk)) || 0)
  const owner = OWNERS.includes(String(user.email || '').toLowerCase())
  if (!owner && usedDay >= DAY_CAP) return json({ error: 'limit', limit: DAY_CAP }, 429)
  if (!owner && usedMonth >= MONTH_CAP) return json({ error: 'month', limit: MONTH_CAP }, 429)
  const count = async () => { if (!owner) { await st.set(dk, String(usedDay + 1)); await st.set(mk, String(usedMonth + 1)) } }

  if (op === 'polish') {
    const text = String(b.text || '').slice(0, 2500)
    if (!text.trim()) return json({ error: 'empty' }, 400)
    await count()
    try {
      const client = new Anthropic()
      const msg = await client.messages.create({
        model: 'claude-opus-5-5', max_tokens: 4000, system: SYSTEM, output_config: { effort: 'medium' },
        messages: [{ role: 'user', content: `לפניך טיוטת הערכה לתעודה שכתב/ה המורה לתלמיד/ה. שפרי את הניסוח: חם, אישי, מקצועי וזורם, בעברית תקנית.
שמרי בדיוק על לשון הפנייה (זכר/נקבה) של הטיוטה, ועל לשון המורה (מאחלת/מאחל וכו׳) כפי שהיא.
אל תוסיפי עובדות שלא כתובות ואל תשמיטי עובדות. אורך דומה. שמרי את החתימה בסוף. החזירי רק את הטקסט.

${text}` }],
      })
      if (msg.stop_reason === 'refusal') return json({ error: 'refusal' }, 422)
      const out = msg.content.map(c => (c.type === 'text' ? c.text : '')).join('').trim()
      return json({ text: out })
    } catch (e) {
      console.warn('polish failed', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e))
      return json({ error: 'error' }, 502)
    }
  }

  if (op === 'start') {
    const kind = b.kind === 'sheet' ? 'sheet' : 'lesson'
    if (!String(b.topic || '').trim()) return json({ error: 'empty' }, 400)
    const raw = JSON.stringify(b)
    if (raw.length > 12_000) return json({ error: 'too-big' }, 413)
    await count()
    const id = crypto.randomUUID()
    await st.setJSON(`job/${id}`, { id, owner: user.id, kind, params: b, status: 'queued', at: Date.now(), counted: owner ? [] : [dk, mk] })
    await fetch(new URL('/api/ai-run', req.url).toString(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) })
    return json({ id })
  }
  return json({ error: 'unknown op' }, 400)
}

export const config: Config = { path: '/api/ai' }
