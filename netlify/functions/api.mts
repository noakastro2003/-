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
const admins = () => (Netlify.env.get("ADMIN_USERS") || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean)
const publicTeacher = (t: any) => ({ user: t.user, name: t.name, school: t.school || "", cfg: t.cfg || {}, codes: t.codes || [], classCode: t.classCode || "", admin: admins().includes(t.user) })
// letters and digits that can't be confused (no 0/O, 1/I/L)
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
const randCode = (n: number) => Array.from(randomBytes(n), b => ALPHA[b % ALPHA.length]).join("")
// a recovery code is shown once; only its hash is kept
function newRecovery(t: any) { const rc = randCode(4) + "-" + randCode(4); t.rsalt = randomBytes(16).toString("hex"); t.rhash = hash(rc, t.rsalt); return rc }
const recoveryOk = (rc: string, t: any) => !!t.rhash && passOk(rc.trim().toUpperCase(), { salt: t.rsalt, hash: t.rhash })
async function ensureClassCode(t: any) {
  if (t.classCode) return false
  for (let tries = 0; tries < 30; tries++) {
    const cc = randCode(5)
    const { modified } = await store().setJSON("classes/" + cc, { user: t.user }, { onlyIfNew: true })
    if (modified) { t.classCode = cc; return true }
  }
  return false
}
async function track(t: any, code: string) {
  t.codes = t.codes || []
  if (!t.codes.includes(code)) t.codes.push(code)
  const who: any = await store().get("students/" + code, { type: "json" })
  if (who) await store().setJSON("students/" + code, { ...who, teacher: t.user, added: Date.now() })
}

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
    if (!code) return bad("busy", 503)
    let teacher = null
    const join = String(body.join || "").trim().toUpperCase()
    if (/^[A-Z0-9]{5}$/.test(join)) {
      const cls: any = await store().get("classes/" + join, { type: "json" })
      const t: any = cls ? await store().get("teachers/" + cls.user, { type: "json" }) : null
      if (t && (t.codes || []).length < 300) { await track(t, code); await store().setJSON("teachers/" + t.user, t); teacher = { name: t.name } }
    }
    return json({ code, teacher })
  }
  // what a class link shows before signing up
  if (route === "class" && m === "GET") {
    const cc = String(url.searchParams.get("code") || "").toUpperCase()
    const cls: any = /^[A-Z0-9]{5}$/.test(cc) ? await store().get("classes/" + cc, { type: "json" }) : null
    const t: any = cls ? await store().get("teachers/" + cls.user, { type: "json" }) : null
    return t ? json({ name: t.name, school: t.school || "" }) : bad("not_found", 404)
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

  // "I'm playing now": sent about once a minute while the game is open, so the teacher sees who is on the site
  if (route === "seen" && m === "POST") {
    const code = body.code
    if (!validCode(code)) return bad()
    const who: any = await store().get("students/" + code, { type: "json" })
    if (!who) return bad("not_found", 404)
    await store().setJSON("seen/" + code, { t: Date.now(), a: typeof body.a === "string" ? body.a.slice(0, 120) : "" })
    return json({ ok: true })
  }

  /* ---- teachers: sign up, sign in ---- */
  if (route === "teachers/register" && m === "POST") {
    const user = String(body.user || "").trim().toLowerCase()
    if (!validUser(user) || !text(body.name, 60) || typeof body.pass !== "string" || body.pass.length < 6 || body.pass.length > 200 || (body.school && !text(body.school, 80))) return bad()
    const salt = randomBytes(16).toString("hex")
    const t: any = { user, name: body.name.trim(), school: (body.school || "").trim(), salt, hash: hash(body.pass, salt), codes: [], cfg: {}, created: Date.now() }
    const recovery = newRecovery(t)
    const { modified } = await store().setJSON("teachers/" + user, t, { onlyIfNew: true })
    if (!modified) return bad("user_taken", 409)
    if (await ensureClassCode(t)) await store().setJSON("teachers/" + user, t)
    return json({ token: await newSession(user), teacher: publicTeacher(t), recovery })
  }
  if (route === "teachers/login" && m === "POST") {
    const user = String(body.user || "").trim().toLowerCase()
    const t: any = validUser(user) ? await store().get("teachers/" + user, { type: "json" }) : null
    if (!t || typeof body.pass !== "string" || !passOk(body.pass, t)) return bad("wrong_login", 401)
    return json({ token: await newSession(user), teacher: publicTeacher(t) })
  }

  // forgotten password: username + recovery code + new password
  if (route === "teachers/reset" && m === "POST") {
    const user = String(body.user || "").trim().toLowerCase()
    const t: any = validUser(user) ? await store().get("teachers/" + user, { type: "json" }) : null
    if (!t || typeof body.recovery !== "string" || !recoveryOk(body.recovery, t)) return bad("wrong_recovery", 401)
    if (typeof body.pass !== "string" || body.pass.length < 6 || body.pass.length > 200) return bad()
    t.salt = randomBytes(16).toString("hex"); t.hash = hash(body.pass, t.salt)
    const recovery = newRecovery(t)
    await store().setJSON("teachers/" + user, t)
    return json({ token: await newSession(user), teacher: publicTeacher(t), recovery })
  }

  /* ---- everything below needs a signed-in teacher ---- */
  const me = await currentTeacher(req)
  if (!me) return bad("unauthorized", 401)
  const { t } = me
  const saveTeacher = () => store().setJSON("teachers/" + t.user, t)

  if (route === "teachers/logout" && m === "POST") { await store().delete("sessions/" + me.token); return json({ ok: true }) }
  if (route === "teachers/me" && m === "GET") { if (await ensureClassCode(t)) await saveTeacher(); return json({ teacher: publicTeacher(t) }) }
  if (route === "teachers/recovery" && m === "POST") { const recovery = newRecovery(t); await saveTeacher(); return json({ recovery }) }
  if (route === "teachers/password" && m === "POST") {
    if (typeof body.old !== "string" || !passOk(body.old, t)) return bad("wrong_login", 401)
    if (typeof body.pass !== "string" || body.pass.length < 6 || body.pass.length > 200) return bad()
    t.salt = randomBytes(16).toString("hex"); t.hash = hash(body.pass, t.salt); await saveTeacher()
    return json({ ok: true })
  }
  // a student added by the teacher: gets a code and is tracked right away
  if (route === "teachers/students/create" && m === "POST") {
    if (!text(body.n, 40) || (body.k && !text(body.k, 20))) return bad()
    if ((t.codes || []).length >= 300) return bad("too_many", 400)
    const code = await newStudentCode(body.n.trim(), (body.k || "").trim())
    if (!code) return bad("busy", 503)
    await track(t, code); await saveTeacher()
    return json({ code })
  }
  /* admin (usernames in ADMIN_USERS): see teachers, reset a password */
  if (route.startsWith("admin/")) {
    if (!admins().includes(t.user)) return bad("forbidden", 403)
    if (route === "admin/teachers" && m === "GET") {
      const { blobs } = await store().list({ prefix: "teachers/" })
      const list = await Promise.all(blobs.map(async b => { const x: any = await store().get(b.key, { type: "json" }); return x && { user: x.user, name: x.name, school: x.school || "", students: (x.codes || []).length, created: x.created } }))
      return json({ teachers: list.filter(Boolean) })
    }
    // find a student by name or code, for a code that a teacher can't add
    if (route === "admin/students" && m === "GET") {
      const q = String(url.searchParams.get("q") || "").trim().slice(0, 40)
      const { blobs } = await store().list({ prefix: "students/" })
      const rows = await Promise.all(blobs.map(async b => { const x: any = await store().get(b.key, { type: "json" }); return x && { code: x.code, n: x.n, k: x.k || "", teacher: x.teacher || "", created: x.created } }))
      const hits = rows.filter(Boolean).filter((x: any) => !q || (x.n || "").includes(q) || x.code.includes(q) || (x.k || "").includes(q))
      return json({ students: hits.sort((a: any, b: any) => (b.created || 0) - (a.created || 0)).slice(0, 100), total: blobs.length })
    }
    if (route === "admin/reset" && m === "POST") {
      const user = String(body.user || "").toLowerCase()
      const x: any = validUser(user) ? await store().get("teachers/" + user, { type: "json" }) : null
      if (!x) return bad("not_found", 404)
      const temp = randCode(4) + "-" + randCode(4)
      x.salt = randomBytes(16).toString("hex"); x.hash = hash(temp, x.salt)
      await store().setJSON("teachers/" + user, x)
      return json({ temp })
    }
  }
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
      const seen: any = await store().get("seen/" + code, { type: "json" })
      const { state, ...rec } = prog || {}
      return { ...rec, code, n: who.n, k: who.k, added: who.added || 0, empty: !prog, seen: seen?.t || 0, doing: seen?.a || "" }
    }))
    return json({ students: rows.filter(Boolean) })
  }
  if (route === "teachers/students" && m === "POST") {
    const code = String(body.code || "").replace(/\D/g, "")
    if (!validCode(code)) { console.log("add student: bad code", JSON.stringify(body.code)); return bad() }
    const who: any = await store().get("students/" + code, { type: "json" })
    if (!who) { console.log("add student: not found", code, "raw", JSON.stringify(body.code)); return bad("not_found", 404) }
    if ((t.codes || []).length >= 300) return bad("too_many", 400)
    await track(t, code); await saveTeacher()
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
