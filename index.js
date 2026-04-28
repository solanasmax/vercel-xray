// api/index.js
export const config = { runtime: 'edge' };

const TARGET_DOMAIN = process.env.TARGET_DOMAIN?.replace(/\/+$/, '') || '';

if (!TARGET_DOMAIN) {
  throw new Error('TARGET_DOMAIN environment variable is required');
}

function filterHeaders(headers) {
  const hopByHop = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade'];
  const filtered = new Headers();
  for (const [key, value] of headers.entries()) {
    const lower = key.toLowerCase();
    if (hopByHop.includes(lower) || lower.startsWith('x-vercel-')) continue;
    filtered.set(key, value);
  }
  return filtered;
}

export default async function handler(req) {
  if (!['GET', 'POST'].includes(req.method)) {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const path = url.pathname + url.search;
  const targetUrl = TARGET_DOMAIN + path;

  const realIp = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();

  let headers = filterHeaders(req.headers);
  if (realIp) headers.set('x-forwarded-for', realIp);

  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers: headers,
    body: req.method === 'POST' ? req.body : undefined,
    duplex: 'half',
    redirect: 'manual',
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}