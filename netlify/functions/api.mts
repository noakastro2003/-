import { getStore } from "@netlify/blobs"
import type { Config } from "@netlify/functions"

// One store for the class: "config" (the teacher's settings), "progress/<device id>" (sent by the game), "roster/<key>" (pasted codes)
const store = () => getStore({ name: "galaxy", consistency: "strong" })
const json = (data: unknown, status = 200) => Response.json(data, { status })

function isTeacher(req: Request) {
  const want = Netlify.env.get("TEACHER_PASSWORD") || ""
  const got = req.headers.get("x-teacher-pass") || ""
  if (!want || got.length !== want.length) return false
  let diff = 0
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i)
  return diff === 0
}
const validId = (s: unknown) => typeof s === "string" && /^[A-Za-z0-9_-]{4,120}$/.test(s)
const validRecord = (r: any) => r && typeof r === "object" && r.v === 1 && typeof r.st === "object" && JSON.stringify(r).length < 20000

async function listJSON(prefix: string) {
  const s = store(), { blobs } = await s.list({ prefix })
  const rows = await Promise.all(blobs.map(async b => ({ id: b.key.slice(prefix.length), ...(await s.get(b.key, { type: "json" })) })))
  return rows.filter(r => r && r.st)
}

export default async (req: Request) => {
  const route = new URL(req.url).pathname.replace(/^\/api\//, "")
  const m = req.method

  if (route === "config" && m === "GET") return json((await store().get("config", { type: "json" })) || {})
  if (route === "progress" && m === "POST") {
    const { id, rec } = await req.json().catch(() => ({}))
    if (!validId(id) || !validRecord(rec)) return json({ error: "bad_request" }, 400)
    await store().setJSON("progress/" + id, { ...rec, t: Date.now() })
    return json({ ok: true })
  }

  // everything below is the teacher's
  if (!Netlify.env.get("TEACHER_PASSWORD")) return json({ error: "no_password_set" }, 503)
  if (!isTeacher(req)) return json({ error: "unauthorized" }, 401)

  if (route === "login" && m === "POST") return json({ ok: true })
  if (route === "config" && m === "PUT") {
    const cfg = await req.json().catch(() => null)
    if (!cfg || typeof cfg !== "object" || JSON.stringify(cfg).length > 50000) return json({ error: "bad_request" }, 400)
    await store().setJSON("config", cfg)
    return json({ ok: true })
  }
  if (route === "progress" && m === "GET") return json({ progress: await listJSON("progress/"), roster: await listJSON("roster/") })
  if (route === "roster" && m === "POST") {
    const { items } = await req.json().catch(() => ({}))
    if (!Array.isArray(items) || items.length > 60) return json({ error: "bad_request" }, 400)
    let saved = 0
    for (const it of items) if (validId(it?.key) && validRecord(it?.rec)) { await store().setJSON("roster/" + it.key, it.rec); saved++ }
    return json({ ok: true, saved })
  }
  if (route === "roster" && m === "DELETE") {
    const id = new URL(req.url).searchParams.get("id")
    if (!validId(id)) return json({ error: "bad_request" }, 400)
    await store().delete("roster/" + id)
    return json({ ok: true })
  }
  return json({ error: "not_found" }, 404)
}

export const config: Config = { path: "/api/*" }
