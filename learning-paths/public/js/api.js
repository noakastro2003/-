// Thin fetch wrapper: JSON in, JSON out, throws Error(message) on failure.
export async function api(method, url, body, headers = {}) {
  const opts = { method, headers: { ...headers }, credentials: 'same-origin' };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, opts);
  } catch {
    throw Object.assign(new Error('אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.'), { status: 0 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'משהו השתבש'), { status: res.status });
  return data;
}
