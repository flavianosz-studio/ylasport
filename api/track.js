// api/track.js — Vercel Function para registrar analytics
// O token do GitHub fica seguro aqui no servidor, nunca exposto ao visitante

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = 'flavianosz-studio';
const GITHUB_REPO  = 'ylasport';
const GITHUB_BRANCH = 'main';
const GH_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents`;

const ghHeaders = {
  'Authorization': `Bearer ${GITHUB_TOKEN}`,
  'Accept': 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
  'User-Agent': 'ylasport-analytics'
};

async function getDataJson() {
  const r = await fetch(`${GH_API}/data.json?ref=${GITHUB_BRANCH}&t=${Date.now()}`, { headers: ghHeaders });
  if (!r.ok) throw new Error(`GitHub GET failed: ${r.status}`);
  const file = await r.json();
  const text = Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf-8');
  return { data: JSON.parse(text), sha: file.sha };
}

async function saveDataJson(data, sha) {
  const content = Buffer.from(JSON.stringify(data, null, 2), 'utf-8').toString('base64');
  const r = await fetch(`${GH_API}/data.json`, {
    method: 'PUT',
    headers: ghHeaders,
    body: JSON.stringify({ message: 'Track analytics', content, sha, branch: GITHUB_BRANCH })
  });
  if (!r.ok) {
    const err = await r.json();
    throw new Error(`GitHub PUT failed: ${r.status} - ${JSON.stringify(err)}`);
  }
  return r.json();
}

export default async function handler(req, res) {
  // Allow CORS from your site
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { type, country, city, album_id, album_name } = req.body;

    if (!['visit', 'buy_click'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const { data, sha } = await getDataJson();
    if (!data.analytics) data.analytics = { visits: [], buy_clicks: [] };

    const date = new Date().toISOString().slice(0, 10);

    if (type === 'visit') {
      data.analytics.visits.push({ date, country: country || 'Unknown', city: city || '' });
      // Keep last 3000
      if (data.analytics.visits.length > 3000) {
        data.analytics.visits = data.analytics.visits.slice(-3000);
      }
    } else {
      data.analytics.buy_clicks.push({ date, album_id, album_name });
      if (data.analytics.buy_clicks.length > 1000) {
        data.analytics.buy_clicks = data.analytics.buy_clicks.slice(-1000);
      }
    }

    await saveDataJson(data, sha);
    return res.status(200).json({ ok: true });

  } catch (e) {
    console.error('Track error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
