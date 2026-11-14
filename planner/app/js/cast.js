// Phone side of "the classroom computer shows, the phone controls".
// The computer opens /cast and shows a code; here we answer its WebRTC offer and then
// send small JSON messages ({kind, data}) straight to it. If no direct link can be
// made, messages go through /api/cast instead (slower, but works on strict networks).
export const cast = { on: false, relay: false, code: '', pc: null, dc: null, last: null, style: null, onChange: null };

const api = (op, code, body) => fetch(`/api/cast?op=${op}&code=${code}`, body
  ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {})
  .then(r => r.json().then(j => ({ ok: r.ok, status: r.status, ...j })));
const iceDone = pc => new Promise(res => {
  if (pc.iceGatheringState === 'complete') return res();
  const t = setTimeout(res, 3500);
  pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
});
const changed = () => cast.onChange && cast.onChange();

export async function castConnect(raw) {
  const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 5) throw Object.assign(new Error('bad-code'), { code: 'bad-code' });
  castEnd(true);
  const off = await api('getoffer', code);
  if (!off.ok || !off.sdp) throw Object.assign(new Error('no-such-code'), { code: 'no-such-code' });
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  cast.pc = pc; cast.code = code;
  const opened = new Promise(res => {
    pc.ondatachannel = e => {
      cast.dc = e.channel;
      e.channel.onopen = () => res(true);
      e.channel.onclose = () => { if (cast.dc === e.channel && !cast.relay) { cast.on = false; changed(); } };
    };
    setTimeout(() => res(false), 9000);
  });
  await pc.setRemoteDescription(off.sdp);
  await pc.setLocalDescription(await pc.createAnswer());
  await iceDone(pc);
  await api('answer', code, { sdp: pc.localDescription });
  const direct = await opened;
  cast.on = true; cast.relay = !direct;
  changed();
  if (cast.style) castStyle(cast.style);
  if (cast.last) castSend(cast.last.kind, cast.last.data);
  return { relay: cast.relay };
}

const PIECE = 60000;
function raw(msg) {
  if (cast.style && msg.kind !== 'style') msg = { ...msg, style: cast.style }; // relay keeps only the latest message
  if (!cast.relay && cast.dc && cast.dc.readyState === 'open') {
    const s = JSON.stringify(msg);
    if (s.length <= PIECE) { cast.dc.send(s); return true; }
    // big pages (an HTML file) go in pieces and are put back together on the screen
    const id = Math.random().toString(36).slice(2), n = Math.ceil(s.length / PIECE);
    for (let i = 0; i < n; i++) cast.dc.send(JSON.stringify({ kind: 'piece', data: { id, i, n, s: s.slice(i * PIECE, (i + 1) * PIECE) } }));
    return true;
  }
  if (JSON.stringify(msg).length > 55000) return 'too-big';
  api('state', cast.code, { msg }).catch(() => {});
  return true;
}
export function castSend(kind, data) {
  cast.last = { kind, data };
  if (!cast.on) return false;
  return raw({ kind, data });
}
// how the classroom screen looks (background, text size, font) – kept apart from what it shows
export function castStyle(style) {
  cast.style = style;
  if (!cast.on) return false;
  return raw({ kind: 'style', data: style });
}

export function castEnd(silent) {
  if (cast.on && cast.relay) api('state', cast.code, { msg: { kind: 'idle' } }).catch(() => {});
  try { cast.dc && cast.dc.close(); } catch { /* fine */ }
  try { cast.pc && cast.pc.close(); } catch { /* fine */ }
  cast.on = false; cast.relay = false; cast.dc = null; cast.pc = null;
  if (!silent) changed();
}
