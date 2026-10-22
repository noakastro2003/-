import { getStore } from "@netlify/blobs"
import type { Config } from "@netlify/functions"
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

/* One store for the whole site:
   students/<code>     a student who signed up: name, class, the teacher who tracks them
   progress/<code>     that student's progress record and saved game
   teachers/<user>     a teacher: name, school, password hash, tracked codes, class settings
   sessions/<token>    a signed-in teacher */
const store = () => getStore({ name: "galaxy", consistency: "strong" })
const json = (data: unknown, status = 200) => Response.json(data, { status })
const bad = (error = "bad_request", status = 400) => json({ error }, status)

const validCode = (s: unknown): s is string => typeof s === "string" && /^[0-9]{6}$/.test(s)
const validUser = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9._@-]{3,60}$/.test(s)
const text = (s: unknown, max: number) => typeof s === "string" && s.trim().length > 0 && s.length <= max
const validRecord = (r: any) => r && typeof r === "object" && r.v === 1 && typeof r.st === "object" && JSON.stringify(r).length < 20000
const validState = (x: unknown) => x === undefined || (x !== null && typeof x === "object" && JSON.stringify(x).length < 120000)
const SESSION_DAYS = 60

const hash = (pass: string, salt: string) => scryptSync(pass, salt, 32).toString("hex")
function passOk(pass: string, t: any) {
  const a = Buffer.from(hash(pass, t.salt), "hex"), b = Buffer.from(t.hash, "hex")
  return a.length === b.length && timingSafeEqual(a, b)
}
const publicTeacher = (t: any) => ({ user: t.user, name: t.name, school: t.school || "", cfg: t.cfg || {}, codes: t.codes || [] })

async function newSession(user: string) {
  const token = randomBytes(24).toString("hex")
  await store().setJSON("sessions/" + token, { user, exp: Date.now() + SESSION_DAYS * 864e5 })
  return token
}
async function currentTeacher(req: Request) {
  const token = req.headers.get("x-teacher-token") || ""
  if (!/^[0-9a-f]{48}$/.test(token)) return null
  const s: any = await store().get("sessions/" + token, { type: "json" })
  if (!s || s.exp < Date.now()) return null
  const t: any = await store().get("teachers/" + s.user, { type: "json" })
  return t ? { t, token } : null
}
async function newStudentCode(n: string, k: string) {
  for (let tries = 0; tries < 30; tries++) {
    const code = String(100000 + Math.floor(Math.random() * 900000))
    const { modified } = await store().setJSON("students/" + code, { code, n, k, created: Date.now() }, { onlyIfNew: true })
    if (modified) return code
  }
  return null
}

export default async (req: Request) => {
  const url = new URL(req.url), route = url.pathname.replace(/^\/api\//, ""), m = req.method
  const body: any = ["POST", "PUT"].includes(m) ? await req.json().catch(() => ({})) : {}

  /* ---- students ---- */
  if (route === "students/register" && m === "POST") {
    if (!text(body.n, 40) || (body.k && !text(body.k, 20))) return bad()
    const code = await newStudentCode(body.n.trim(), (body.k || "").trim())
    return code ? json({ code }) : bad("busy", 503)
  }
  if (route === "me" && m === "GET") {
    const code = url.searchParams.get("code")
    if (!validCode(code)) return bad()
    const who: any = await store().get("students/" + code, { type: "json" })
    if (!who) return bad("not_found", 404)
    const prog: any = await store().get("progress/" + code, { type: "json" })
    const t: any = who.teacher ? await store().get("teachers/" + who.teacher, { type: "json" }) : null
    return json({ n: who.n, k: who.k, state: prog?.state || null, cfg: t?.cfg || null, teacher: t ? { name: t.name, school: t.school || "" } : null })
  }
  if (route === "progress" && m === "POST") {
    const { code, rec, state } = body
    if (!validCode(code) || !validRecord(rec) || !validState(state)) return bad()
    const who: any = await store().get("students/" + code, { type: "json" })
    if (!who) return bad("not_found", 404)
    await store().setJSON("progress/" + code, { ...rec, code, t: Date.now(), state })
    return json({ ok: true })
  }

  /* ---- teachers: sign up, sign in ---- */
  if (route === "teachers/register" && m === "POST") {
    const user = String(body.user || "").trim().toLowerCase()
    if (!validUser(user) || !text(body.name, 60) || typeof body.pass !== "string" || body.pass.length < 6 || body.pass.length > 200 || (body.school && !text(body.school, 80))) return bad()
    const salt = randomBytes(16).toString("hex")
    const t = { user, name: body.name.trim(), school: (body.school || "").trim(), salt, hash: hash(body.pass, salt), codes: [], cfg: {}, created: Date.now() }
    const { modified } = await store().setJSON("teachers/" + user, t, { onlyIfNew: true })
    if (!modified) return bad("user_taken", 409)
    return json({ token: await newSession(user), teacher: publicTeacher(t) })
  }
  if (route === "teachers/login" && m === "POST") {
    const user = String(body.user || "").trim().toLowerCase()
    const t: any = validUser(user) ? await store().get("teachers/" + user, { type: "json" }) : null
    if (!t || typeof body.pass !== "string" || !passOk(body.pass, t)) return bad("wrong_login", 401)
    return json({ token: await newSession(user), teacher: publicTeacher(t) })
  }

  /* ---- everything below needs a signed-in teacher ---- */
  const me = await currentTeacher(req)
  if (!me) return bad("unauthorized", 401)
  const { t } = me
  const saveTeacher = () => store().setJSON("teachers/" + t.user, t)

  if (route === "teachers/logout" && m === "POST") { await store().delete("sessions/" + me.token); return json({ ok: true }) }
  if (route === "teachers/me" && m === "GET") return json({ teacher: publicTeacher(t) })
  if (route === "teachers/config" && m === "PUT") {
    if (!body.cfg || typeof body.cfg !== "object" || JSON.stringify(body.cfg).length > 50000) return bad()
    t.cfg = body.cfg
    if (text(body.cfg.teacher, 60)) t.name = body.cfg.teacher.trim()
    if (typeof body.cfg.school === "string" && body.cfg.school.length <= 80) t.school = body.cfg.school.trim()
    await saveTeacher()
    return json({ teacher: publicTeacher(t) })
  }
  if (route === "teachers/students" && m === "GET") {
    const rows = await Promise.all((t.codes || []).map(async (code: string) => {
      const who: any = await store().get("students/" + code, { type: "json" })
      if (!who) return null
      const prog: any = await store().get("progress/" + code, { type: "json" })
      const { state, ...rec } = prog || {}
      return { ...rec, code, n: who.n, k: who.k, added: who.added || 0, empty: !prog }
    }))
    return json({ students: rows.filter(Boolean) })
  }
  if (route === "teachers/students" && m === "POST") {
    const code = String(body.code || "").replace(/\D/g, "")
    if (!validCode(code)) return bad()
    const who: any = await store().get("students/" + code, { type: "json" })
    if (!who) return bad("not_found", 404)
    if ((t.codes || []).length >= 300) return bad("too_many", 400)
    if (!t.codes.includes(code)) { t.codes.push(code); await saveTeacher() }
    // the student follows this teacher's class settings
    await store().setJSON("students/" + code, { ...who, teacher: t.user, added: Date.now() })
    return json({ ok: true, n: who.n, k: who.k })
  }
  if (route === "teachers/students" && m === "DELETE") {
    const code = url.searchParams.get("code")
    if (!validCode(code)) return bad()
    t.codes = (t.codes || []).filter((c: string) => c !== code); await saveTeacher()
    const who: any = await store().get("students/" + code, { type: "json" })
    if (who && who.teacher === t.user) { const { teacher, ...rest } = who; await store().setJSON("students/" + code, rest) }
    return json({ ok: true })
  }
  return bad("not_found", 404)
}

export const config: Config = { path: "/api/*" }
