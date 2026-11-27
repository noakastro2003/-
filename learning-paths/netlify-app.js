// Runs the same app as server.js inside Netlify Functions: Netlify Database for the data,
// Netlify Blobs for uploaded pictures and recordings, and a background function for the
// AI generator (a normal function may only run for 60 seconds).
import { getConnectionString } from '@netlify/database';
import { getStore } from '@netlify/blobs';
import { openDb } from './db.js';
import { createApp } from './server.js';

let app;
export function getApp(siteUrl) {
  if (app) return app;
  const db = openDb({ url: getConnectionString() });
  const media = getStore({ name: 'media', consistency: 'strong' });
  app = createApp(db, {
    mediaStore: {
      put: (id, buf, mime) => media.set(id, buf, { metadata: { mime } }),
      get: async (id) => {
        const data = await media.get(id, { type: 'arrayBuffer' });
        return data ? Buffer.from(data) : null;
      },
    },
    // Request bodies on Netlify are capped at 6MB, and files arrive base64-encoded.
    mediaMaxBytes: 4 * 1024 * 1024,
    startJob: async (id) => {
      const res = await fetch(new URL('/.netlify/functions/ai-job-background', siteUrl), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      if (res.status !== 202 && !res.ok) throw new Error(`background function answered ${res.status}`);
    },
  });
  return app;
}

// A Node-style (req, res) handler → a function from a web Request to a web Response.
export function webHandler(getHandler) {
  return async (request, context) => {
    const url = new URL(request.url);
    const handler = getHandler(url);
    const body = ['GET', 'HEAD'].includes(request.method) ? Buffer.alloc(0) : Buffer.from(await request.arrayBuffer());
    const headers = Object.fromEntries([...request.headers].map(([k, v]) => [k.toLowerCase(), v]));
    headers['x-forwarded-proto'] = url.protocol.replace(':', '');
    const req = {
      method: request.method,
      url: url.pathname + url.search,
      headers,
      socket: { remoteAddress: context?.ip || headers['x-nf-client-connection-ip'] || '' },
      async *[Symbol.asyncIterator]() { if (body.length) yield body; },
    };
    return new Promise((resolve, reject) => {
      const out = new Headers();
      let status = 200;
      const res = {
        setHeader: (k, v) => out.set(k, v),
        writeHead: (s, h = {}) => {
          status = s;
          for (const [k, v] of Object.entries(h)) out.set(k, String(v));
        },
        end: (data) => resolve(new Response(status === 204 || data === undefined ? null : data, { status, headers: out })),
      };
      handler(req, res).catch(reject);
    });
  };
}

export const handle = webHandler((url) => getApp(process.env.URL || url.origin));
