// Claude helps the teacher: a full lesson, a worksheet in three levels, or polishing a report-card comment.
// Runs through Netlify AI Gateway (credentials are injected; usage is paid from the site's credits).
// Signed-in teachers only, a daily cap per teacher, and the answer streams back so long lessons stay under 60s.
import Anthropic from '@anthropic-ai/sdk'
import { getUser } from '@netlify/identity'
import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'

const DAILY = 15
const json = (x: unknown, status = 200) => Response.json(x, { status, headers: { 'cache-control': 'no-store' } })

const VOICE = `את מורה ותיקה ומנוסה בבית ספר יסודי בישראל, שכותבת לעמיתה. כותבים בעברית פשוטה, חמה ומקצועית, לפי תוכנית הלימודים של משרד החינוך.
מתאימים לגיל ולכיתה שנאמרו, לפעילות אמיתית בכיתה (לא תיאוריה), עם הוראות קצרות וברורות. לא ממציאים קבצים, קישורים או ספרים שלא נאמרו.`

const LESSON = {
  type: 'object', additionalProperties: false, required: ['title', 'goal', 'sections', 'materials', 'homework', 'differentiation'],
  properties: {
    title: { type: 'string' }, goal: { type: 'string' },
    sections: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['label', 'minutes', 'text'], properties: { label: { type: 'string' }, minutes: { type: 'integer' }, text: { type: 'string' } } } },
    materials: { type: 'array', items: { type: 'string' } },
    homework: { type: 'string' },
    differentiation: { type: 'string' },
  },
}
const SHEET = {
  type: 'object', additionalProperties: false, required: ['title', 'levels'],
  properties: {
    title: { type: 'string' },
    levels: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'instructions', 'items'], properties: { name: { type: 'string' }, instructions: { type: 'string' }, items: { type: 'array', items: { type: 'string' } } } } },
  },
}

function request(kind: string, b: any) {
  const grade = String(b.grade || '').slice(0, 20), topic = String(b.topic || '').slice(0, 300), notes = String(b.notes || '').slice(0, 800)
  if (kind === 'lesson') return {
    schema: LESSON, max: 6000,
    prompt: `בני/בניי שיעור ${b.minutes ? `של ${Number(b.minutes)} דקות ` : ''}לכיתה ${grade} בנושא: ${topic}.
${notes ? `דגשים מהמורה: ${notes}\n` : ''}מבנה: פתיחה (מעוררת עניין), גוף השיעור (פעילות פעילה, עדיף בזוגות/קבוצות), סיום (סיכום ובדיקת הבנה). לכל חלק – כמה דקות ומה עושים בפועל, במשפטים קצרים.
"materials" – מה צריך להכין או להביא. "homework" – משימה קצרה (או מחרוזת ריקה). "differentiation" – משפט או שניים: איך להתאים לתלמידים מתקשים ולמתקדמים.`,
  }
  if (kind === 'sheet') return {
    schema: SHEET, max: 6000,
    prompt: `בני/בניי דף עבודה לכיתה ${grade} בנושא: ${topic}, בשלוש רמות: "בסיסי", "מתקדם", "אתגר". בכל רמה 5–6 משימות קצרות שאפשר לפתור על הדף, מהקל לקשה.
${notes ? `דגשים מהמורה: ${notes}\n` : ''}הוראה אחת קצרה לכל רמה. בלי תשובות.`,
  }
  // polish a report-card comment, keeping every fact the teacher wrote
  return {
    schema: null, max: 2000,
    prompt: `לפניך טיוטת הערכה לתעודה שכתבה מורה לתלמיד/ה. שפרי את הניסוח שיהיה חם, אישי ומקצועי, באותה לשון פנייה (זכר/נקבה) ובאותו אורך בערך.
אל תוסיפי עובדות שלא כתובות, אל תשמיטי עובדות, ושמרי את החתימה בסוף. החזירי רק את הטקסט המשופר.

${String(b.text || '').slice(0, 2500)}`,
  }
}

export default async (req: Request) => {
  const user = await getUser()
  if (!user) return json({ error: 'login' }, 401)
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'not-ready' }, 503) // AI Gateway not active yet

  const b = (await req.json().catch(() => ({}))) as any
  const kind = ['lesson', 'sheet', 'polish'].includes(b.kind) ? b.kind : ''
  if (!kind || (kind !== 'polish' && !String(b.topic || '').trim()) || (kind === 'polish' && !String(b.text || '').trim())) return json({ error: 'empty' }, 400)

  const st = getStore({ name: 'hakita-ai', consistency: 'strong' })
  const ck = `n/${user.id}/${new Date().toISOString().slice(0, 10)}`
  const used = Number((await st.get(ck)) || 0)
  if (used >= DAILY) return json({ error: 'limit', limit: DAILY }, 429)
  await st.set(ck, String(used + 1))

  const r = request(kind, b)
  const client = new Anthropic()
  const enc = new TextEncoder()
  const body = new ReadableStream({
    async start(ctrl) {
      try {
        const stream = client.messages.stream({
          model: 'claude-opus-5-5',
          max_tokens: r.max,
          system: VOICE,
          output_config: { effort: 'low', ...(r.schema ? { format: { type: 'json_schema', schema: r.schema } } : {}) },
          messages: [{ role: 'user', content: r.prompt }],
        })
        stream.on('text', t => ctrl.enqueue(enc.encode(t)))
        const msg = await stream.finalMessage()
        if (msg.stop_reason === 'refusal') ctrl.enqueue(enc.encode('\n\u0000refusal'))
        else if (msg.stop_reason === 'max_tokens') ctrl.enqueue(enc.encode('\n\u0000cut'))
      } catch (e) {
        console.warn('ai failed', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e))
        ctrl.enqueue(enc.encode('\n\u0000error'))
      }
      ctrl.close()
    },
  })
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
}

export const config: Config = { path: '/api/ai' }
