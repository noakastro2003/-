// Where the demo keeps its data. In a claude.ai viewer: the viewer's private subtree of the
// artifact's database (survives reloads and works across devices). Elsewhere: localStorage,
// and if even that is blocked, memory for this visit.
//
// The data is a handful of documents ({id: body}): "meta" plus one "path-<id>" per path.

const LOCAL_KEY = 'lp-demo-v1';

async function capability(name) {
  try {
    return window.claude?.use ? await window.claude.use(name) : null;
  } catch {
    return null;
  }
}

async function dbStore(onError) {
  const [db, user] = await Promise.all([capability('db'), capability('user')]);
  const uid = db && user ? await user.id().catch(() => null) : null;
  if (!uid) return null;
  const col = db.collection(`data/users/${uid}`);
  const snap = await col.get();
  const docs = {};
  for (const d of snap.docs) docs[d.id] = structuredClone(d.data());

  // One write at a time per document; a burst of changes collapses into the latest body.
  const pending = new Map();
  const running = new Set();
  const flush = async (id) => {
    running.add(id);
    while (pending.has(id)) {
      const body = pending.get(id);
      pending.delete(id);
      try {
        if (body === null) await col.doc(id).delete();
        else await col.doc(id).set(body);
      } catch (e) {
        onError(e);
      }
    }
    running.delete(id);
  };
  const write = (id, body) => {
    pending.set(id, body === null ? null : structuredClone(body));
    if (!running.has(id)) flush(id);
  };
  return { kind: 'db', docs, save: write, remove: (id) => write(id, null) };
}

function localStore() {
  let docs = {};
  try {
    docs = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') || {};
  } catch {
    return { kind: 'memory', docs: {}, save() {}, remove() {} };
  }
  const persist = () => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(docs));
    } catch { /* storage full or blocked: keep going in memory */ }
  };
  return {
    kind: 'local',
    docs,
    save(id, body) { docs[id] = structuredClone(body); persist(); },
    remove(id) { delete docs[id]; persist(); },
  };
}

export async function openStore(onError = () => {}) {
  try {
    const store = await dbStore(onError);
    if (store) return store;
  } catch (e) {
    console.warn('db unavailable, using browser storage', e);
  }
  return localStore();
}
