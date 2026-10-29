// The site's API: students get a 6-digit code that keeps their whole game; teachers sign up, track codes and set what the class learns.
// Storage is Netlify Blobs (one store, JSON documents):
//   students/<code>   { code, n, k, created, teacher, rec, state, saved, seen, doing }
//   teachers/<user>   { user, name, school, salt, hash, rsalt, rhash, classCode, codes, cfg, created }
//   tokens/<token>    { user, created }
//   classes/<code5>   { user }
import { getStore } from "@netlify/blobs";
import { randomBytes, scryptSync, timingSafeEqual, randomInt } from "node:crypto";

const ADMINS = (process.env.I100_ADMINS || "noakastro").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
let store = null;
const db = () => store || (store = globalThis.__I100_STORE || getStore({ name: "island100", consistency: "strong" }));
const get = async key => { try { return await db().get(key, { type: "json" }); } catch (e) { return null; } };
const put = (key, val) => db().setJSON(key, val);
const del = key => db().delete(key);

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const fail = (error, status = 400) => json({ error }, status);
const clip = (v, n) => String(v ?? "").trim().slice(0, n);

function hashPass(pass, salt = randomBytes(16).toString("hex")) { return { salt, hash: scryptSync(String(pass), salt, 32).toString("hex") }; }
function passOk(pass, salt, hash) {
  if (!salt || !hash) return false;
  const a = scryptSync(String(pass), salt, 32), b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
const recoveryCode = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", pick = () => A[randomInt(A.length)]; return Array.from({ length: 4 }, pick).join("") + "-" + Array.from({ length: 4 }, pick).join(""); };
const normRecovery = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

async function newStudentCode() {
  for (let i = 0; i < 40; i++) { const c = String(randomInt(100000, 1000000)); if (!(await get("students/" + c))) return c; }
  throw new Error("no code");
}
async function newClassCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 40; i++) { const c = Array.from({ length: 5 }, () => A[randomInt(A.length)]).join(""); if (!(await get("classes/" + c))) return c; }
  throw new Error("no code");
}
// what a teacher's own screen may see of her account
const pub = t => ({ user: t.user, name: t.name, school: t.school || "", classCode: t.classCode || "", codes: t.codes || [], cfg: t.cfg || {}, admin: ADMINS.includes(t.user) });
// one row of the teacher's class table: the progress record plus who/when
const row = s => ({ ...(s.rec || {}), code: s.code, n: s.n, k: s.k, seen: s.seen || 0, doing: s.doing || "", t: (s.rec && s.rec.t) || 0, empty: !s.rec });

async function session(req) {
  const tok = req.headers.get("x-teacher-token") || "";
  if (!/^[a-f0-9]{48}$/.test(tok)) return null;
  const t = await get("tokens/" + tok); if (!t) return null;
  const teacher = await get("teachers/" + t.user);
  return teacher ? { tok, teacher } : null;
}
async function signIn(teacher, extra = {}) {
  const token = randomBytes(24).toString("hex");
  await put("tokens/" + token, { user: teacher.user, created: Date.now() });
  return json({ token, teacher: pub(teacher), ...extra });
}
async function track(teacher, code) {
  const s = await get("students/" + code); if (!s) return null;
  teacher.codes = [...new Set([...(teacher.codes || []), code])];
  await put("teachers/" + teacher.user, teacher);
  s.teacher = teacher.user; await put("students/" + code, s);
  return s;
}

export default async (req) => {
  const url = new URL(req.url), path = url.pathname.replace(/^.*?\/api\//, "").replace(/\/+$/, ""), m = req.method;
  const body = m === "GET" || m === "DELETE" ? {} : await req.json().catch(() => ({}));
  try {
    /* ---------- students ---------- */
    if (path === "students/register" && m === "POST") {
      const code = await newStudentCode(), s = { code, n: clip(body.n, 30) || "תלמיד", k: clip(body.k, 20), created: Date.now(), teacher: "" };
      await put("students/" + code, s);
      let teacher = null;
      const join = clip(body.join, 5).toUpperCase();
      if (/^[A-Z0-9]{5}$/.test(join)) { const c = await get("classes/" + join); const t = c && await get("teachers/" + c.user); if (t) { await track(t, code); teacher = { name: t.name }; } }
      return json({ code, teacher });
    }
    if (path === "me" && m === "GET") {
      const s = await get("students/" + clip(url.searchParams.get("code"), 6)); if (!s) return fail("not_found", 404);
      const t = s.teacher ? await get("teachers/" + s.teacher) : null;
      return json({ n: s.n, k: s.k, state: s.state || null, cfg: t ? { ...(t.cfg || {}), teacher: t.name, school: t.school || "" } : null, teacher: t ? { name: t.name } : null });
    }
    if (path === "progress" && m === "POST") {
      const s = body.code && await get("students/" + clip(body.code, 6)); if (!s) return fail("not_found", 404);
      if (body.rec && typeof body.rec === "object") { s.rec = body.rec; if (body.rec.n) s.n = clip(body.rec.n, 30); if (body.rec.k !== undefined) s.k = clip(body.rec.k, 20); }
      if (body.state && typeof body.state === "object" && JSON.stringify(body.state).length < 200000) { s.state = body.state; s.saved = Date.now(); }
      await put("students/" + s.code, s); return json({ ok: true });
    }
    if (path === "seen" && m === "POST") {
      const s = body.code && await get("students/" + clip(body.code, 6)); if (!s) return json({ ok: false });
      s.seen = Date.now(); s.doing = clip(body.a, 80); await put("students/" + s.code, s); return json({ ok: true });
    }
    if (path === "class" && m === "GET") {
      const c = await get("classes/" + clip(url.searchParams.get("code"), 5).toUpperCase()); const t = c && await get("teachers/" + c.user);
      return t ? json({ name: t.name, school: t.school || "" }) : fail("not_found", 404);
    }

    /* ---------- teachers: account ---------- */
    if (path === "teachers/register" && m === "POST") {
      const user = clip(body.user, 60).toLowerCase(), name = clip(body.name, 60);
      if (!/^[a-z0-9._@-]{3,60}$/.test(user) || String(body.pass || "").length < 6 || !name) return fail("bad_request");
      if (await get("teachers/" + user)) return fail("user_taken", 409);
      const rec = recoveryCode(), p = hashPass(body.pass), r = hashPass(normRecovery(rec)), classCode = await newClassCode();
      const t = { user, name, school: clip(body.school, 80), salt: p.salt, hash: p.hash, rsalt: r.salt, rhash: r.hash, classCode, codes: [], cfg: {}, created: Date.now() };
      await put("teachers/" + user, t); await put("classes/" + classCode, { user });
      return signIn(t, { recovery: rec });
    }
    if (path === "teachers/login" && m === "POST") {
      const t = await get("teachers/" + clip(body.user, 60).toLowerCase());
      if (!t || !passOk(body.pass, t.salt, t.hash)) return fail("wrong_login", 401);
      return signIn(t);
    }
    if (path === "teachers/reset" && m === "POST") {
      const t = await get("teachers/" + clip(body.user, 60).toLowerCase());
      if (String(body.pass || "").length < 6) return fail("bad_request");
      if (!t || !passOk(normRecovery(body.recovery), t.rsalt, t.rhash)) return fail("wrong_recovery", 401);
      const rec = recoveryCode(), p = hashPass(body.pass), r = hashPass(normRecovery(rec));
      Object.assign(t, { salt: p.salt, hash: p.hash, rsalt: r.salt, rhash: r.hash }); await put("teachers/" + t.user, t);
      return signIn(t, { recovery: rec });
    }

    const sess = await session(req);
    if (path.startsWith("teachers/") || path.startsWith("admin/")) { if (!sess) return fail("unauthorized", 401); }
    const T = sess && sess.teacher;

    if (path === "teachers/me" && m === "GET") return json({ teacher: pub(T) });
    if (path === "teachers/logout" && m === "POST") { await del("tokens/" + sess.tok); return json({ ok: true }); }
    if (path === "teachers/password" && m === "POST") {
      if (!passOk(body.old, T.salt, T.hash)) return fail("wrong_login", 401);
      if (String(body.pass || "").length < 6) return fail("bad_request");
      Object.assign(T, hashPass(body.pass)); await put("teachers/" + T.user, T); return json({ ok: true });
    }
    if (path === "teachers/recovery" && m === "POST") {
      const rec = recoveryCode(), r = hashPass(normRecovery(rec)); T.rsalt = r.salt; T.rhash = r.hash; await put("teachers/" + T.user, T);
      return json({ recovery: rec });
    }
    if (path === "teachers/config" && m === "PUT") {
      const cfg = body.cfg && typeof body.cfg === "object" ? body.cfg : {};
      T.cfg = { testDate: clip(cfg.testDate, 10), message: clip(cfg.message, 500), classes: Array.isArray(cfg.classes) ? cfg.classes.slice(0, 20).map(c => clip(c, 20)) : [],
        stations: cfg.stations && typeof cfg.stations === "object" ? cfg.stations : {}, ordered: cfg.ordered !== false, challenge: cfg.challenge !== false };
      if (cfg.teacher) T.name = clip(cfg.teacher, 60);
      if (cfg.school !== undefined) T.school = clip(cfg.school, 80);
      await put("teachers/" + T.user, T); return json({ teacher: pub(T) });
    }

    /* ---------- teachers: students ---------- */
    if (path === "teachers/students" && m === "GET") {
      const list = (await Promise.all((T.codes || []).map(c => get("students/" + c)))).filter(Boolean);
      return json({ students: list.map(row) });
    }
    if (path === "teachers/students" && m === "POST") {
      const code = clip(body.code, 6); if (!/^\d{6}$/.test(code)) return fail("bad_request");
      const s = await track(T, code); return s ? json({ n: s.n, k: s.k }) : fail("not_found", 404);
    }
    if (path === "teachers/students" && m === "DELETE") {
      const code = clip(url.searchParams.get("code"), 6); T.codes = (T.codes || []).filter(c => c !== code); await put("teachers/" + T.user, T); return json({ ok: true });
    }
    if (path === "teachers/students/create" && m === "POST") {
      const n = clip(body.n, 30); if (!n) return fail("bad_request");
      const code = await newStudentCode(); await put("students/" + code, { code, n, k: clip(body.k, 20), created: Date.now(), teacher: T.user });
      T.codes = [...(T.codes || []), code]; await put("teachers/" + T.user, T); return json({ code });
    }

    /* ---------- the site's admin ---------- */
    if (path.startsWith("admin/") && !ADMINS.includes(T.user)) return fail("forbidden", 403);
    if (path === "admin/teachers" && m === "GET") {
      const { blobs } = await db().list({ prefix: "teachers/" });
      const all = (await Promise.all(blobs.map(b => get(b.key)))).filter(Boolean);
      return json({ teachers: all.map(t => ({ user: t.user, name: t.name, school: t.school || "", students: (t.codes || []).length, created: t.created || 0 })) });
    }
    if (path === "admin/students" && m === "GET") {
      const q = clip(url.searchParams.get("q"), 40), { blobs } = await db().list({ prefix: "students/" });
      const all = (await Promise.all(blobs.map(b => get(b.key)))).filter(Boolean);
      const hit = all.filter(s => !q || (s.n || "").includes(q) || (s.k || "").includes(q) || s.code.includes(q)).slice(0, 60);
      return json({ total: all.length, students: hit.map(s => ({ code: s.code, n: s.n, k: s.k, teacher: s.teacher || "", created: s.created || 0 })) });
    }
    if (path === "admin/reset" && m === "POST") {
      const t = await get("teachers/" + clip(body.user, 60).toLowerCase()); if (!t) return fail("not_found", 404);
      const temp = String(randomInt(100000, 1000000)) + "ab"; Object.assign(t, hashPass(temp)); await put("teachers/" + t.user, t);
      return json({ temp });
    }
    return fail("not_found", 404);
  } catch (e) {
    console.error(e);
    return fail("server_error", 500);
  }
};

export const config = { path: "/api/*" };
