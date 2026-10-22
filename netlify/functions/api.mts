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
const validCode = (s: unknown) => typeof s === "string" && /^[0-9]{6}$/.test(s)
const validState = (x: unknown) => x === undefined || (x !== null && typeof x === "object" && JSON.stringify(x).length < 120000)
const validRecord = (r: any) => r && typeof r === "object" && r.v === 1 && typeof r.st === "object" && JSON.stringify(r).length < 20000

async function listJSON(prefix: string) {
  const s = store(), { blobs } = await s.list({ prefix })
  const rows = await Promise.all(blobs.map(async b => ({ id: b.key.slice(prefix.length), ...(await s.get(b.key, { type: "json" })) })))
  return rows.filter(r => r && (r.st || r.code)).map(({ state, ...r }) => r)
}

export default async (req: Request) => {
  const route = new URL(req.url).pathname.replace(/^\/api\//, "")
  const m = req.method

  if (route === "config" && m === "GET") return json((await store().get("config", { type: "json" })) || {})
  // a student code from the teacher: who it is, and the game state saved under it (to continue on another device)
  if (route === "me" && m === "GET") {
    const code = new URL(req.url).searchParams.get("code")
    if (!validCode(code)) return json({ error: "bad_request" }, 400)
    const who: any = await store().get("students/" + code, { type: "json" })
    if (!who) return json({ error: "not_found" }, 404)
    const prog: any = await store().get("progress/c-" + code, { type: "json" })
    return json({ n: who.n, k: who.k, state: prog?.state || null })
  }
  if (route === "progress" && m === "POST") {
    const { id, rec, code, state } = await req.json().catch(() => ({}))
    if (code !== undefined) {
      if (!validCode(code) || !validRecord(rec) || !validState(state)) return json({ error: "bad_request" }, 400)
      const who: any = await store().get("students/" + code, { type: "json" })
      if (!who) return json({ error: "not_found" }, 404)
      await store().setJSON("progress/c-" + code, { ...rec, n: who.n, k: who.k, code, t: Date.now(), state })
      return json({ ok: true })
    }
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
  if (route === "students" && m === "GET") return json({ students: await listJSON("students/") })
  if (route === "students" && m === "POST") {
    const { n, k } = await req.json().catch(() => ({}))
    if (typeof n !== "string" || !n.trim() || n.length > 40 || (k !== undefined && (typeof k !== "string" || k.length > 20))) return json({ error: "bad_request" }, 400)
    for (let tries = 0; tries < 20; tries++) {
      const code = String(Math.floor(100000 + Math.random() * 900000))
      const { modified } = await store().setJSON("students/" + code, { code, n: n.trim(), k: (k || "").trim(), created: Date.now() }, { onlyIfNew: true })
      if (modified) return json({ code })
    }
    return json({ error: "busy" }, 503)
  }
  if (route === "students" && m === "DELETE") {
    const code = new URL(req.url).searchParams.get("code")
    if (!validCode(code)) return json({ error: "bad_request" }, 400)
    await store().delete("students/" + code)
    await store().delete("progress/c-" + code)
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
