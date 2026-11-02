// Leaderboard API – one Blob object per (world, player) best score.
// Pathname: lb/<world>/<999999-score, 6 digits>-<timestamp>-<base64url name>.json
// Blob listing is lexicographic, so the highest scores come first with no extra reads.
import { put, list, del } from '@vercel/blob';
import { isProfane, cleanName } from './_profanity.js';

const WORLDS = new Set(['easy', 'medium', 'hard']);
const MAX_SCORE = 2000;
const TOP = 10;
const WINDOW = 300;
const FILE_RE = /^(\d{6})-(\d+)-(.+)\.json$/;

function parse(blob) {
  const m = FILE_RE.exec(blob.pathname.split('/').pop());
  if (!m) return null;
  let name;
  try { name = Buffer.from(m[3], 'base64url').toString('utf8'); } catch { return null; }
  return { name, score: 999999 - parseInt(m[1], 10), url: blob.url };
}

async function readBoard(world) {
  const { blobs } = await list({ prefix: `lb/${world}/`, limit: WINDOW });
  const seen = new Set();
  const all = [];
  for (const b of blobs) {
    const e = parse(b);
    if (!e) continue;
    all.push(e);
  }
  const best = [];
  for (const e of all) {            // already sorted best-first
    const k = e.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); best.push(e);
  }
  return { all, best };
}

const publicEntries = best => best.slice(0, TOP).map(({ name, score }) => ({ name, score }));

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (req.method === 'GET') {
      const world = String(req.query.world || '');
      if (!WORLDS.has(world)) return res.status(400).json({ error: 'invalid_world' });
      const { best } = await readBoard(world);
      res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=30');
      return res.status(200).json({ world, entries: publicEntries(best) });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const world = String(body.world || '');
      const score = body.score;
      if (!WORLDS.has(world)) return res.status(400).json({ error: 'invalid_world' });
      if (!Number.isInteger(score) || score < 1 || score > MAX_SCORE) return res.status(400).json({ error: 'invalid_score' });
      const name = cleanName(body.name);
      if (!name) return res.status(400).json({ error: 'invalid_name' });
      if (isProfane(name)) return res.status(400).json({ error: 'name_rejected' });

      const { all } = await readBoard(world);
      const key = name.toLowerCase();
      const mine = all.filter(e => e.name.toLowerCase() === key);
      const prev = mine.length ? Math.max(...mine.map(e => e.score)) : 0;
      let improved = false;

      if (score > prev) {
        const file = `lb/${world}/${String(999999 - score).padStart(6, '0')}-${Date.now()}-${Buffer.from(name).toString('base64url')}.json`;
        await put(file, '{}', { access: 'public', addRandomSuffix: false, contentType: 'application/json' });
        if (mine.length) await del(mine.map(e => e.url));
        all.push({ name, score, url: '' });
        all.sort((a, b) => b.score - a.score);
        improved = true;
      }
      const seen = new Set();
      const best = [];
      for (const e of all) {
        const k = e.name.toLowerCase();
        if (e.name.toLowerCase() === key && e.score !== Math.max(score, prev)) continue;
        if (seen.has(k)) continue;
        seen.add(k); best.push(e);
      }
      const rank = best.findIndex(e => e.name.toLowerCase() === key) + 1;
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, improved, name, score: Math.max(score, prev), rank, entries: publicEntries(best) });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error('scores api error', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
