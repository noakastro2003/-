// Background worker for the AI helper: takes a queued job, lets Claude think it through (high effort),
// and stores the structured result for the app to pick up. Runs up to 15 minutes; the caller already got its 202.
import Anthropic from '@anthropic-ai/sdk'
import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'
import { SYSTEM, buildPrompt } from '../lib/ai-prompts.mts'

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
    if (msg.stop_reason === 'refusal') { job.status = 'error'; job.error = 'refusal' }
    else if (msg.stop_reason === 'max_tokens') { job.status = 'error'; job.error = 'cut' }
    else {
      const text = msg.content.map(c => (c.type === 'text' ? c.text : '')).join('')
      job.result = JSON.parse(text); job.status = 'done'
    }
  } catch (e) {
    console.warn('ai-run failed', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e))
    job.status = 'error'; job.error = 'error'
  }
  job.done = Date.now()
  await st.setJSON(key, job)
}

export const config: Config = { path: '/api/ai-run', background: true }
