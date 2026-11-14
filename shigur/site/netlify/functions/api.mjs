/* =====================================================================
   3, 2, 1… שיגור! – השרת של "משחקים עם חברים"
   פונקציה אחת של Netlify (/api) + אחסון Netlify Blobs. אין צורך בהגדרה.

   מה נשמר:
     c/{classCode}  – מי מחובר בכיתה (שם פרטי + צבע טיל) והזמנות פתוחות
     r/{code}       – חדר משחק: חברים, מצב המשחק, תגובות
     rooms-index    – זמן יצירת כל חדר, כדי למחוק חדרים בני יותר מ-24 שעות

   זהות: כל טלפון שומר "אסימון" אקראי. השרת מחשב ממנו מזהה (hash), כך שאי
   אפשר להתחזות לילד אחר בלי האסימון שלו. כל שינוי נשמר רק אם אף אחד לא
   שינה את הנתונים באמצע (onlyIfMatch) – ואם כן, מנסים שוב.
   ===================================================================== */
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const ROCKETS = new Set(["moon", "mars", "jupiter"]);
const CODE_RE = /^[A-Z0-9]{4}$/;
const CODE_ABC = "ACDEFGHJKMNPQRTUVWXY2345679";
const DAY = 86400000;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

let storeOverride = null;               // לבדיקות מקומיות בלבד
export function __setStore(s) { storeOverride = s; }
const store = () => storeOverride || getStore({ name: "shigur", consistency: "strong" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (x) => JSON.parse(JSON.stringify(x));

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
const uidOf = (tok) => createHash("sha256").update("shigur:" + tok).digest("hex").slice(0, 20);

/* ---------- ניקוי ---------- */
function pruneClass(c, now) {
  c.p = c.p || {}; c.inv = c.inv || {};
  for (const u of Object.keys(c.p)) if (now - (c.p[u].ts || 0) > DAY) delete c.p[u];
  for (const to of Object.keys(c.inv)) {
    for (const code of Object.keys(c.inv[to])) if (now - (c.inv[to][code].ts || 0) > 120000) delete c.inv[to][code];
    if (!Object.keys(c.inv[to]).length) delete c.inv[to];
  }
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

/* ---------- הפעולות ---------- */
async function handle(b, me, now) {
  const cls = cleanCls(b.cls);
  const ckey = "c/" + cls;
  const name = cleanName(b.name);
  const rocket = ROCKETS.has(b.rocket) ? b.rocket : "moon";
  const code = String(b.code || "").toUpperCase();
  const roomKey = "r/" + code;

  switch (b.op) {
    case "poll": {
      // נוכחות: מעדכנים רק כשצריך (חוסך כתיבות)
      let c = (await read(ckey)) || { p: {}, inv: {} };
      const mine = c.p && c.p[me];
      const busy = !!b.busy;
      if (name && (!mine || now - (mine.ts || 0) > 8000 || mine.n !== name || mine.r !== rocket || !!mine.b !== busy)) {
        const res = await mutate(ckey, (d) => { d = pruneClass(d || { p: {}, inv: {} }, now); d.p[me] = { n: name, r: rocket, ts: now, b: busy }; return d; });
        c = res.data;
      }
      const p = {};
      for (const [u, x] of Object.entries(c.p || {})) if (now - (x.ts || 0) < 120000) p[u] = { name: x.n, rocket: x.r, ts: x.ts, busy: !!x.b };
      const inv = {};
      for (const [k, x] of Object.entries((c.inv || {})[me] || {})) if (now - (x.ts || 0) < 60000) inv[k] = x;
      let room = null;
      if (CODE_RE.test(code)) {
        const r = await read(roomKey);
        room = r && r.members && r.members[me] ? r : null;
      }
      return { me, now, presence: p, invites: inv, room };
    }

    case "create": {
      const level = [1, 2, 3].includes(+b.level) ? +b.level : 1;
      cleanupRooms(now).catch(() => {});
      for (let k = 0; k < 10; k++) {
        let c4 = ""; for (let i = 0; i < 4; i++) c4 += CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)];
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
      if (!CODE_RE.test(code)) return { error: "none" };
      let err = null;
      const res = await mutate(roomKey, (r) => {
        if (!r) { err = "none"; return undefined; }
        if (r.cls !== cls) { err = "other"; return undefined; }
        if (r.members && r.members[me]) return undefined;           // כבר בפנים
        if (r.status !== "wait") { err = "started"; return undefined; }
        if (Object.keys(r.members || {}).length >= 3) { err = "full"; return undefined; }
        r.members[me] = { name, rocket, j: now };
        return r;
      });
      if (err) return { error: err };
      // ההזמנה כבר לא צריכה להיות פתוחה
      await mutate(ckey, (c) => { if (!c || !c.inv || !c.inv[me] || !c.inv[me][code]) return undefined; delete c.inv[me][code]; return c; }).catch(() => {});
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

    case "invite": {
      const to = (Array.isArray(b.to) ? b.to : []).filter((u) => typeof u === "string" && /^[0-9a-f]{20}$/.test(u) && u !== me).slice(0, 2);
      const level = [1, 2, 3].includes(+b.level) ? +b.level : 1;
      const r = await read(roomKey);
      if (!r || !r.members || !r.members[me]) return { error: "none" };
      await mutate(ckey, (c) => {
        c = pruneClass(c || { p: {}, inv: {} }, now);
        for (const u of to) { if (!c.p[u]) continue; c.inv[u] = c.inv[u] || {}; c.inv[u][code] = { from: me, name, rocket, level, room: code, ts: now }; }
        return c;
      });
      return { ok: true };
    }

    case "uninvite": {      // מוחק הזמנה: מי שהוזמן, או מי ששלח
      const to = String(b.to || me);
      await mutate(ckey, (c) => {
        const x = c && c.inv && c.inv[to] && c.inv[to][code];
        if (!x || (to !== me && x.from !== me)) return undefined;
        delete c.inv[to][code]; if (!Object.keys(c.inv[to]).length) delete c.inv[to];
        return c;
      });
      return { ok: true };
    }

    case "decline": {
      await mutate(ckey, (c) => { if (!c || !c.inv || !c.inv[me] || !c.inv[me][code]) return undefined; delete c.inv[me][code]; return c; }).catch(() => {});
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

export default async (req) => {
  if (req.method !== "POST") return json({ ok: true, service: "shigur" });
  let b;
  try { b = await req.json(); } catch (e) { return json({ error: "bad" }, 400); }
  const tok = String((b && b.tok) || "");
  if (!/^[A-Za-z0-9]{24,64}$/.test(tok)) return json({ error: "auth" }, 401);
  try {
    return json(await handle(b, uidOf(tok), Date.now()));
  } catch (e) {
    console.error(e);
    return json({ error: "server" }, 500);
  }
};

export const config = { path: "/api" };
