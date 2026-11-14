/* =====================================================================
   3, 2, 1… שיגור! – השרת: חשבונות ילדים, חברים, הזמנות וחדרים
   פונקציה אחת של Netlify (/api) + אחסון Netlify Blobs. אין צורך בהגדרה.

   מה נשמר (רק שם פרטי וצבע טיל – שום מידע אישי אחר):
     u/{userCode}  – חשבון: שם, טיל, קוד סודי (מוצפן), חברים, בקשות חברות, הזמנות
     sess/{hash}   – כניסה פעילה של טלפון (אסימון אקראי ← קוד משתמש)
     p/{userCode}  – מתי הילד נראה לאחרונה (כדי לדעת אם חבר מחובר)
     c/{classCode} – מי מחובר עכשיו בכיתה
     r/{roomCode}  – חדר משחק: חברים, מצב המשחק, תגובות
     rooms-index   – זמן יצירת חדרים, למחיקה אחרי 24 שעות

   כל שינוי נשמר רק אם אף אחד לא שינה את הנתונים באמצע (onlyIfMatch),
   ואם כן – מנסים שוב.
   ===================================================================== */
import { getStore } from "@netlify/blobs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ROCKETS = new Set(["moon", "mars", "jupiter"]);
const ROOM_RE = /^\d{4}$/;          // קוד חדר: 4 ספרות
const USER_RE = /^\d{5}$/;          // קוד משתמש: 5 ספרות (בלי אותיות – קל לילדים)
const CODE_ABC = "0123456789";
const DAY = 86400000;
const MAX_FRIENDS = 40, MAX_REQ = 20;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

let storeOverride = null;               // לבדיקות מקומיות בלבד
export function __setStore(s) { storeOverride = s; }
const store = () => storeOverride || getStore({ name: "shigur", consistency: "strong" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (x) => JSON.parse(JSON.stringify(x));
const sha = (s) => createHash("sha256").update(s).digest("hex");
const randCode = (n) => { const b = randomBytes(n); let c = ""; for (let i = 0; i < n; i++) c += CODE_ABC[b[i] % CODE_ABC.length]; return c; };

// קריאה-שינוי-כתיבה בטוחה: כותבים רק אם לא השתנה מאז שקראנו
async function mutate(key, fn) {
  const st = store();
  for (let i = 0; i < 10; i++) {
    const cur = await st.getWithMetadata(key, { type: "json", consistency: "strong" });
    const data = cur ? cur.data : null;
    const next = fn(data == null ? null : clone(data));
    if (next === undefined) return { data, changed: false };
    if (next === null) { if (cur) await st.delete(key); return { data: null, changed: true }; }
    if (key.startsWith("r/")) next.v = ((data && data.v) || 0) + 1;      // גרסה – כדי שהטלפון לא יחזור לנתונים ישנים
    const res = await st.setJSON(key, next, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (res && res.modified) return { data: next, changed: true };
    await sleep(25 + Math.random() * 80 * (i + 1));
  }
  throw new Error("busy");
}
const read = (key) => store().get(key, { type: "json", consistency: "strong" });

const cleanName = (v) => String(v || "").normalize("NFC").replace(/[֑-ׇ]/g, "").replace(/[^\p{L}]/gu, "").slice(0, 14);
const cleanCls = (v) => (String(v || "").trim().replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 40) || "class");
const pinHash = (salt, pin) => sha("shigur-pin:" + salt + ":" + pin);
const sameHash = (a, b) => { try { return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch (e) { return false; } };
const sessKey = (tok) => "sess/" + sha("shigur-sess:" + tok).slice(0, 40);

async function newSession(code) {
  const tok = randomBytes(24).toString("hex");
  await store().setJSON(sessKey(tok), { code, ts: Date.now() });
  return tok;
}
async function whoAmI(tok) {
  if (!/^[A-Za-z0-9]{24,64}$/.test(tok)) return null;
  const s = await read(sessKey(tok));
  return s && USER_RE.test(s.code) ? s.code : null;
}

/* ---------- ניקוי ---------- */
function pruneUser(u, now) {
  u.friends = u.friends || {}; u.req = u.req || {}; u.sent = u.sent || {}; u.inv = u.inv || {};
  for (const k of Object.keys(u.inv)) if (now - (u.inv[k].ts || 0) > 120000) delete u.inv[k];
  for (const k of Object.keys(u.req)) if (now - (u.req[k].ts || 0) > 30 * DAY) delete u.req[k];
  for (const k of Object.keys(u.sent)) if (now - (u.sent[k] || 0) > 30 * DAY) delete u.sent[k];
  return u;
}
function pruneClass(c, now) {
  c.p = c.p || {};
  for (const u of Object.keys(c.p)) if (now - (c.p[u].ts || 0) > DAY) delete c.p[u];
  delete c.inv;
  return c;
}
async function cleanupRooms(now) {
  const idx = (await read("rooms-index")) || {};
  const old = Object.keys(idx).filter((k) => now - idx[k] > DAY);
  if (!old.length) return;
  for (const k of old) await store().delete("r/" + k).catch(() => {});
  await mutate("rooms-index", (d) => { if (!d) return undefined; for (const k of old) delete d[k]; return d; }).catch(() => {});
}
async function deleteRoom(code) {
  await store().delete("r/" + code).catch(() => {});
  await mutate("rooms-index", (d) => { if (!d || !(code in d)) return undefined; delete d[code]; return d; }).catch(() => {});
}
const pub = (u) => ({ name: u.name, rocket: u.rocket });

/* ---------- הרשמה וכניסה (בלי אסימון) ---------- */
async function account(b, now) {
  if (b.op === "register") {
    const name = cleanName(b.name), rocket = ROCKETS.has(b.rocket) ? b.rocket : "moon";
    if (!name) return { error: "name" };
    if (!/^\d{4}$/.test(String(b.pin || ""))) return { error: "pin" };
    for (let k = 0; k < 10; k++) {
      const code = randCode(5), salt = randomBytes(8).toString("hex");
      const u = { code, name, rocket, salt, pin: pinHash(salt, String(b.pin)), cls: cleanCls(b.cls), created: now, friends: {}, req: {}, sent: {}, inv: {}, fails: 0, lockUntil: 0 };
      const res = await store().setJSON("u/" + code, u, { onlyIfNew: true });
      if (res && res.modified) return { tok: await newSession(code), code, name, rocket };
    }
    return { error: "busy" };
  }
  if (b.op === "login") {
    const code = String(b.code || "").toUpperCase(), pin = String(b.pin || "");
    if (!USER_RE.test(code) || !/^\d{4}$/.test(pin)) return { error: "login" };
    const u = await read("u/" + code);
    if (!u) return { error: "login" };
    if ((u.lockUntil || 0) > now) return { error: "locked" };
    if (!sameHash(pinHash(u.salt, pin), u.pin)) {
      await mutate("u/" + code, (x) => { if (!x) return undefined; x.fails = (x.fails || 0) + 1; if (x.fails >= 5) { x.fails = 0; x.lockUntil = now + 5 * 60000; } return x; });
      return { error: "login" };
    }
    if (u.fails) await mutate("u/" + code, (x) => { if (!x) return undefined; x.fails = 0; return x; });
    return { tok: await newSession(code), code, name: u.name, rocket: u.rocket };
  }
  return null;
}

/* ---------- כל השאר (רק עם כניסה פעילה) ---------- */
async function handle(b, me, now) {
  const ukey = "u/" + me;
  const u = await read(ukey);
  if (!u) return { error: "auth" };
  const { name, rocket } = u;
  const cls = cleanCls(b.cls);
  const ckey = "c/" + cls;
  const code = String(b.code || "").toUpperCase();
  const roomKey = "r/" + code;

  switch (b.op) {
    case "logout":
      await store().delete(sessKey(String(b.tok))).catch(() => {});
      return { ok: true };

    case "profile": {
      const n = cleanName(b.name), r = ROCKETS.has(b.rocket) ? b.rocket : rocket;
      if (!n) return { error: "name" };
      await mutate(ukey, (x) => { if (!x) return undefined; x.name = n; x.rocket = r; return x; });
      return { ok: true, name: n, rocket: r };
    }

    case "poll": {
      // נוכחות: מעדכנים רק כשצריך (חוסך כתיבות)
      let c = (await read(ckey)) || { p: {} };
      const mine = c.p && c.p[me];
      const busy = !!b.busy;
      if (!mine || now - (mine.ts || 0) > 8000 || mine.n !== name || mine.r !== rocket || !!mine.b !== busy) {
        const res = await mutate(ckey, (d) => { d = pruneClass(d || { p: {} }, now); d.p[me] = { n: name, r: rocket, ts: now, b: busy }; return d; });
        c = res.data;
        await store().setJSON("p/" + me, { n: name, r: rocket, ts: now, b: busy });
      }
      const presence = {};
      for (const [k, x] of Object.entries(c.p || {})) if (now - (x.ts || 0) < 120000) presence[k] = { name: x.n, rocket: x.r, ts: x.ts, busy: !!x.b };
      let friends = null;
      if (b.wantFriends) {
        friends = {};
        const codes = Object.keys(u.friends || {});
        const ps = await Promise.all(codes.map((k) => read("p/" + k).catch(() => null)));
        codes.forEach((k, i) => { const p = ps[i], f = u.friends[k] || {}; friends[k] = { name: (p && p.n) || f.name, rocket: (p && p.r) || f.rocket, ts: (p && p.ts) || 0, busy: !!(p && p.b) }; });
      }
      const invites = {};
      for (const [k, x] of Object.entries(u.inv || {})) if (now - (x.ts || 0) < 60000) invites[k] = x;
      let room = null;
      if (ROOM_RE.test(code)) {
        const r = await read(roomKey);
        room = r && r.members && r.members[me] ? r : null;
      }
      return { me, now, profile: { code: me, name, rocket }, presence, friends, invites, requests: u.req || {}, sent: Object.keys(u.sent || {}), room };
    }

    /* ----- חברים ----- */
    case "friendReq": {
      const to = String(b.to || "").toUpperCase();
      if (!USER_RE.test(to)) return { error: "nouser" };
      if (to === me) return { error: "self" };
      if ((u.friends || {})[to]) return { ok: true, already: true };
      const t = await read("u/" + to);
      if (!t) return { error: "nouser" };
      if ((u.req || {})[to]) return friendAccept(me, u, to, now);            // שניהם ביקשו – הם חברים
      if (Object.keys(u.friends || {}).length >= MAX_FRIENDS) return { error: "full" };
      let full = false;
      await mutate("u/" + to, (x) => {
        if (!x) return undefined; x = pruneUser(x, now);
        if (x.friends[me]) return undefined;
        if (Object.keys(x.req).length >= MAX_REQ && !x.req[me]) { full = true; return undefined; }
        x.req[me] = { name, rocket, ts: now }; return x;
      });
      if (full) return { error: "full" };
      await mutate(ukey, (x) => { if (!x) return undefined; x = pruneUser(x, now); x.sent[to] = now; return x; });
      return { ok: true, name: t.name, rocket: t.rocket };
    }
    case "friendAnswer": {
      const from = String(b.from || "").toUpperCase();
      if (!USER_RE.test(from) || !(u.req || {})[from]) return { ok: true };
      if (b.yes) return friendAccept(me, u, from, now);
      await mutate(ukey, (x) => { if (!x || !x.req || !x.req[from]) return undefined; delete x.req[from]; return x; });
      await mutate("u/" + from, (x) => { if (!x || !x.sent || !x.sent[me]) return undefined; delete x.sent[me]; return x; });
      return { ok: true };
    }
    case "unfriend": {
      const other = String(b.other || "").toUpperCase();
      if (!USER_RE.test(other)) return { ok: true };
      await mutate(ukey, (x) => { if (!x || !x.friends || !x.friends[other]) return undefined; delete x.friends[other]; return x; });
      await mutate("u/" + other, (x) => { if (!x || !x.friends || !x.friends[me]) return undefined; delete x.friends[me]; return x; });
      return { ok: true };
    }

    /* ----- חדרים ----- */
    case "create": {
      const level = [1, 2, 3].includes(+b.level) ? +b.level : 1;
      cleanupRooms(now).catch(() => {});
      for (let k = 0; k < 10; k++) {
        const c4 = randCode(4);
        const room = { v: 1, host: me, cls, level, created: now, status: "wait", members: { [me]: { name, rocket, j: now } } };
        const res = await store().setJSON("r/" + c4, room, { onlyIfNew: true });
        if (res && res.modified) {
          await mutate("rooms-index", (d) => { d = d || {}; d[c4] = now; return d; });
          return { code: c4, room };
        }
      }
      return { error: "busy" };
    }

    case "join": {
      if (!ROOM_RE.test(code)) return { error: "none" };
      let err = null;
      const res = await mutate(roomKey, (r) => {
        if (!r) { err = "none"; return undefined; }
        if (r.members && r.members[me]) return undefined;           // כבר בפנים
        const invited = (u.inv || {})[code];
        if (r.cls !== cls && !invited) { err = "other"; return undefined; }
        if (r.status !== "wait") { err = "started"; return undefined; }
        if (Object.keys(r.members || {}).length >= 4) { err = "full"; return undefined; }   // עד 4 שחקנים
        r.members[me] = { name, rocket, j: now };
        return r;
      });
      if (err) return { error: err };
      await mutate(ukey, (x) => { if (!x || !x.inv || !x.inv[code]) return undefined; delete x.inv[code]; return x; }).catch(() => {});
      return { room: res.data };
    }

    case "leave": {
      let empty = false;
      await mutate(roomKey, (r) => {
        if (!r || !r.members || !r.members[me]) return undefined;
        delete r.members[me];
        if (r.again) delete r.again[me];
        if (!Object.keys(r.members).length) { empty = true; return undefined; }
        if (r.host === me) r.host = Object.keys(r.members)[0];
        return r;
      });
      if (empty) await deleteRoom(code);                                // החדר נמחק בסיום
      return { ok: true };
    }

    case "invite": {       // אפשר להזמין חבר (מכל כיתה) או ילד מהכיתה שמחובר עכשיו
      const level = [1, 2, 3].includes(+b.level) ? +b.level : 1;
      const r = await read(roomKey);
      if (!r || !r.members || !r.members[me]) return { error: "none" };
      const c = (await read(ckey)) || { p: {} };
      const to = (Array.isArray(b.to) ? b.to : []).map((x) => String(x).toUpperCase())
        .filter((k) => USER_RE.test(k) && k !== me && ((u.friends || {})[k] || (c.p[k] && now - (c.p[k].ts || 0) < 120000))).slice(0, 3);
      for (const k of to) {
        await mutate("u/" + k, (x) => { if (!x) return undefined; x = pruneUser(x, now); x.inv[code] = { from: me, name, rocket, level, room: code, ts: now }; return x; }).catch(() => {});
      }
      return { ok: true, sent: to.length };
    }

    case "uninvite": {      // מוחק הזמנה ששלחתי
      const to = String(b.to || "").toUpperCase();
      if (!USER_RE.test(to)) return { ok: true };
      await mutate("u/" + to, (x) => { const v = x && x.inv && x.inv[code]; if (!v || v.from !== me) return undefined; delete x.inv[code]; return x; }).catch(() => {});
      return { ok: true };
    }

    case "decline": {
      await mutate(ukey, (x) => { if (!x || !x.inv || !x.inv[code]) return undefined; delete x.inv[code]; return x; }).catch(() => {});
      await mutate(roomKey, (r) => { if (!r) return undefined; r.declined = r.declined || {}; r.declined[me] = name; return r; });
      return { ok: true };
    }

    // כל שינוי במשחק: רק חבר בחדר, ורק אם המשחק לא השתנה מאז שהוא ראה אותו
    case "start": case "act": case "restart": {
      const g = b.game;
      if (!g || typeof g !== "object" || JSON.stringify(g).length > 60000) return { error: "bad" };
      let err = null;
      const res = await mutate(roomKey, (r) => {
        if (!r || !r.members || !r.members[me]) { err = "none"; return undefined; }
        const cur = r.game;
        if (b.op === "start") {
          if (r.host !== me || r.status !== "wait") { err = "conflict"; return undefined; }
          r.status = "play"; r.game = g; delete r.again; return r;
        }
        if (b.op === "restart") {
          if (!cur || cur.phase !== "end" || g.gid === cur.gid) { err = "conflict"; return undefined; }
          r.game = g; r.status = "play"; delete r.again; return r;
        }
        if (!cur || cur.gid !== b.gid || cur.seq !== b.expectSeq || g.gid !== cur.gid || g.seq !== cur.seq + 1) { err = "conflict"; return undefined; }
        r.game = g; return r;
      });
      const room = err ? await read(roomKey) : res.data;
      return err ? { error: err, room: room && room.members && room.members[me] ? room : null } : { room };
    }

    case "vote": {
      const res = await mutate(roomKey, (r) => { if (!r || !r.members || !r.members[me]) return undefined; r.again = r.again || {}; r.again[me] = true; return r; });
      return { room: res.data };
    }

    case "react": {
      const i = +b.r;
      if (!(i >= 0 && i <= 6)) return { error: "bad" };
      await mutate(roomKey, (r) => { if (!r || !r.members || !r.members[me]) return undefined; r.reactions = r.reactions || {}; r.reactions[me] = { r: i, ts: now }; return r; });
      return { ok: true };
    }
  }
  return { error: "op" };
}

async function friendAccept(me, u, other, now) {
  const t = await read("u/" + other);
  if (!t) return { error: "nouser" };
  await mutate("u/" + me, (x) => { if (!x) return undefined; x = pruneUser(x, now); delete x.req[other]; delete x.sent[other]; x.friends[other] = pub(t); return x; });
  await mutate("u/" + other, (x) => { if (!x) return undefined; x = pruneUser(x, now); delete x.req[me]; delete x.sent[me]; x.friends[me] = pub(u); return x; });
  return { ok: true, friends: true, name: t.name, rocket: t.rocket };
}

export default async (req) => {
  if (req.method !== "POST") return json({ ok: true, service: "shigur" });
  let b;
  try { b = await req.json(); } catch (e) { return json({ error: "bad" }, 400); }
  if (!b || typeof b !== "object") return json({ error: "bad" }, 400);
  const now = Date.now();
  try {
    const acc = await account(b, now);
    if (acc) return json(acc);
    const me = await whoAmI(String(b.tok || ""));
    if (!me) return json({ error: "auth" }, 401);
    return json(await handle(b, me, now));
  } catch (e) {
    console.error(e);
    return json({ error: "server" }, 500);
  }
};

export const config = { path: "/api" };
