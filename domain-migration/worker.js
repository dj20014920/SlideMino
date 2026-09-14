// Compatibility identifiers for the preserved Pages Functions deployment.
// Network requests always retain the new hostname and use same-zone origin fetch.
const originAliases = new Map([
  ['https://slidemino.cdjstudio.xyz', 'https://slidemino.emozleep.space'],
  ['https://www.slidemino.cdjstudio.xyz', 'https://www.slidemino.emozleep.space'],
]);

function migrateLocation(value, base) {
  if (!value) return value;
  const location = new URL(value, base);
  if (location.hostname === 'emozleep.space' || location.hostname.endsWith('.emozleep.space')) {
    location.hostname = location.hostname.replace(/emozleep\.space$/, 'cdjstudio.xyz');
    return location.href;
  }
  return value;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    // A Route on these exact hosts reaches Pages through fetch(request), preserving
    // client IP and all existing Functions. Cross-zone proxying would pool rate limits.
    if (!originAliases.has(url.origin)) return new Response('API is available on the published domain', { status: 503 });
    const origin = request.headers.get('origin');
    if (origin) {
      try {
        const hostname = new URL(origin).hostname;
        if (hostname === 'emozleep.space' || hostname.endsWith('.emozleep.space')) {
          return Response.json({ error: 'Blocked by origin policy' }, { status: 403, headers: { 'cache-control': 'no-store', 'x-cdj-domain-migration': 'slidemino-v1' } });
        }
      } catch { /* The unchanged Pages origin policy rejects malformed origins. */ }
    }
    const legacyOrigin = originAliases.get(origin);
    const headers = new Headers(request.headers);
    if (legacyOrigin) {
      headers.set('origin', legacyOrigin);
    }
    const upstream = await fetch(new Request(request, { headers, redirect: 'manual' }));
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('x-cdj-domain-migration', 'slidemino-v1');
    const allowedOrigin = responseHeaders.get('access-control-allow-origin');
    const publicAllowedOrigin = [...originAliases].find(([, legacy]) => legacy === allowedOrigin)?.[0];
    if (publicAllowedOrigin) {
      responseHeaders.set('access-control-allow-origin', publicAllowedOrigin);
      const vary = responseHeaders.get('vary');
      if (!vary?.split(',').some(value => value.trim().toLowerCase() === 'origin')) responseHeaders.set('vary', vary ? vary + ', Origin' : 'Origin');
    }
    const location = responseHeaders.get('location');
    if (location) responseHeaders.set('location', migrateLocation(location, request.url));
    const cookies = responseHeaders.getSetCookie();
    if (cookies.length) {
      responseHeaders.delete('set-cookie');
      for (const cookie of cookies) {
        responseHeaders.append('set-cookie', cookie.replace(/(;\s*domain\s*=\s*)(\.?(?:[a-z0-9-]+\.)*emozleep\.space)(?=;|$)/gi, (_, key, domain) => key + domain.replace(/emozleep\.space$/i, 'cdjstudio.xyz')));
      }
    }
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
  },
};
