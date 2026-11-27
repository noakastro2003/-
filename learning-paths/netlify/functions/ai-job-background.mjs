// Builds a path with the AI generator, for up to 15 minutes, after /api/ai/generate queued it.
// Only runs jobs that are still queued, so calling it from outside does no harm.
import { getApp } from '../../netlify-app.js';

export default async (request) => {
  const { id } = await request.json().catch(() => ({}));
  if (typeof id !== 'string' || !/^[0-9a-f]{32}$/.test(id)) return;
  await getApp(process.env.URL || new URL(request.url).origin).runJob(id);
};

export const config = { background: true };
