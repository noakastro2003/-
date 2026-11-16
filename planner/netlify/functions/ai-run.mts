// Background worker for the AI helper: takes a queued job, lets Claude think it through (high effort),
// and stores the structured result for the app to pick up. Runs up to 15 minutes; the caller already got its 202.
import Anthropic from '@anthropic-ai/sdk'
import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'
import { SYSTEM, buildPrompt } from '../lib/ai-prompts.mts'

// the answer should be pure JSON; if anything wraps it (a fence, a sentence), take the outermost object
function readJson(t: string): any {
  try { return JSON.parse(t) } catch { /* try harder */ }
  const i = t.indexOf('{'), j = t.lastIndexOf('}')
  if (i < 0 || j <= i) return null
  try { return JSON.parse(t.slice(i, j + 1)) } catch { return null }
}
// a result is only "done" if it has real content
function looksRight(kind: string, r: any): boolean {
  if (!r || typeof r !== 'object' || !String(r.title || '').trim()) return false
  if (kind === 'sheet') return Array.isArray(r.levels) && r.levels.length > 0 && r.levels.every((l: any) => Array.isArray(l.items) && l.items.length > 0)
  return Array.isArray(r.sections) && r.sections.length > 0
}

export default async (req: Request) => {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string }
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return
  const st = getStore({ name: 'hakita-ai', consistency: 'strong' })
  const key = `job/${id}`
  const job = (await st.get(key, { type: 'json' })) as any
  if (!job || job.status !== 'queued') return // unknown, or already taken (a retry)
  job.status = 'running'; await st.setJSON(key, job)
  const r = buildPrompt(job.kind, job.params)
  try {
    const client = new Anthropic()
    const stream = client.messages.stream({
      model: 'claude-opus-5-5',
      max_tokens: 32000,
      system: SYSTEM,
      output_config: { effort: 'high', format: { type: 'json_schema', schema: r.schema } },
      messages: [{ role: 'user', content: r.prompt }],
    })
    const msg = await stream.finalMessage()
    const text = msg.content.map(c => (c.type === 'text' ? c.text : '')).join('')
    // what came back, kept so a bad result can be understood (no student data is ever sent here)
    job.diag = { stop: msg.stop_reason, types: msg.content.map(c => c.type).join(','), len: text.length, out: msg.usage?.output_tokens, head: text.slice(0, 600) }
    console.log('ai-run', id, JSON.stringify(job.diag).slice(0, 900))
    if (msg.stop_reason === 'refusal') { job.status = 'error'; job.error = 'refusal' }
    else if (msg.stop_reason === 'max_tokens') { job.status = 'error'; job.error = 'cut' }
    else {
      const res = readJson(text)
      if (!res || !looksRight(job.kind, res)) { job.status = 'error'; job.error = 'empty' }
      else { job.result = res; job.status = 'done' }
    }
  } catch (e) {
    console.warn('ai-run failed', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e))
    job.status = 'error'; job.error = 'error'; job.diag = { fail: e instanceof Anthropic.APIError ? `${e.status} ${String(e.message).slice(0, 300)}` : String(e).slice(0, 300) }
  }
  job.done = Date.now()
  // a build that failed or came back empty doesn't use up the teacher's or the site's quota
  if (job.status === 'error' && Array.isArray(job.counted)) for (const k of job.counted) { const n = Number((await st.get(k)) || 0); if (n > 0) await st.set(k, String(n - 1)) }
  await st.setJSON(key, job)
}

export const config: Config = { path: '/api/ai-run', background: true }
