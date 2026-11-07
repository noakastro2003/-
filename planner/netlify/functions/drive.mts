// Fetches a Google Drive / Docs file that is shared "anyone with the link" and returns
// it as a PDF, so the phone can share the actual file (not just a link) to print or send.
import type { Config } from '@netlify/functions'

const ID = /^[\w-]{10,}$/

function target(raw: string): string | null {
  let u: URL
  try { u = new URL(raw) } catch { return null }
  const id = (u.pathname.match(/\/d\/([\w-]{10,})/) || [])[1] || u.searchParams.get('id') || ''
  if (!ID.test(id)) return null
  if (u.hostname === 'docs.google.com') {
    if (u.pathname.startsWith('/document/')) return `https://docs.google.com/document/d/${id}/export?format=pdf`
    if (u.pathname.startsWith('/presentation/')) return `https://docs.google.com/presentation/d/${id}/export/pdf`
    if (u.pathname.startsWith('/spreadsheets/')) return `https://docs.google.com/spreadsheets/d/${id}/export?format=pdf`
    return null
  }
  if (u.hostname === 'drive.google.com' || u.hostname === 'drive.usercontent.google.com') {
    return `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`
  }
  return null
}

export default async (req: Request) => {
  const raw = new URL(req.url).searchParams.get('u') || ''
  const t = target(raw)
  if (!t) return new Response('unsupported link', { status: 400 })
  const r = await fetch(t, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (hakita)' } })
  const type = (r.headers.get('content-type') || '').split(';')[0]
  // a private file answers with Google's sign-in HTML page instead of the file
  if (!r.ok || type === 'text/html') return new Response('not public', { status: 403 })
  const len = Number(r.headers.get('content-length') || 0)
  if (len > 19 * 1024 * 1024) return new Response('too big', { status: 413 })
  const disp = r.headers.get('content-disposition') || ''
  const name = decodeURIComponent((disp.match(/filename\*=UTF-8''([^;]+)/i) || [])[1] || '') || (disp.match(/filename="([^"]+)"/i) || [])[1] || ''
  return new Response(r.body, {
    headers: {
      'content-type': type || 'application/pdf',
      'x-file-name': encodeURIComponent(name),
      'cache-control': 'private, max-age=600',
    },
  })
}

export const config: Config = { path: '/api/drive' }
