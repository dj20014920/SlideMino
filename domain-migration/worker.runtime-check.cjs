const fs = require('node:fs');
const assert = require('node:assert/strict');
// Use a Miniflare 4 installation; the caller may supply an absolute module path.
// MINIFLARE_WORKERD_PATH can select a workerd build supporting 2026-09-03.
const { Miniflare } = require(process.env.MINIFLARE_MODULE || 'miniflare');
(async () => {
 process.chdir(__dirname);
 const seen = [];
 const mf = new Miniflare({
  compatibilityDate: '2026-09-03',
  modules: [{ type: 'ESModule', path: 'worker.js', contents: fs.readFileSync('worker.js', 'utf8') }],
  serviceBindings: { ASSETS: async () => new Response('static fixture') },
  outboundService: async request => {
   seen.push({ url: request.url, method: request.method, body: await request.text(), headers: Object.fromEntries(request.headers) });
   const allowed = ['https://slidemino.emozleep.space', 'https://www.slidemino.emozleep.space', 'capacitor://localhost'];
   const headers = new Headers({ 'content-type': 'application/json', 'access-control-allow-origin': request.headers.get('origin') || 'https://slidemino.emozleep.space', 'cache-control': 'no-store', location: 'https://slidemino.emozleep.space/admin' });
   headers.append('set-cookie', 'admin=fixture; Domain=slidemino.emozleep.space; Path=/; Secure; HttpOnly; SameSite=Strict');
   headers.append('set-cookie', 'external=unchanged; Domain=example.com; Secure');
   headers.append('set-cookie', 'Domain=emozleep.space; Domain=notemozleep.space; Secure');
   return new Response('{"unchanged":true}', { status: allowed.includes(request.headers.get('origin')) ? 400 : 403, headers });
  },
 });
 try {
  for (const host of ['slidemino', 'www.slidemino']) {
   const origin = 'https://' + host + '.cdjstudio.xyz';
   const response = await mf.dispatchFetch(origin + '/api/submit?preserved=1', { method: 'POST', body: '{invalid', headers: { origin, referer: origin + '/play?x=1', 'sec-fetch-site': 'same-origin', 'cf-connecting-ip': '203.0.113.10', 'x-real-ip': '203.0.113.10', cookie: 'admin=fixture', authorization: 'Bearer local-fixture' } });
   assert.equal(response.status, 400); assert.equal(await response.text(), '{"unchanged":true}');
   assert.equal(response.headers.get('access-control-allow-origin'), origin);
   assert.equal(response.headers.get('location'), 'https://slidemino.cdjstudio.xyz/admin');
   const cookies = response.headers.getSetCookie();
   assert(cookies.includes('admin=fixture; Domain=slidemino.cdjstudio.xyz; Path=/; Secure; HttpOnly; SameSite=Strict'));
   assert(cookies.includes('external=unchanged; Domain=example.com; Secure'));
   assert(cookies.includes('Domain=emozleep.space; Domain=notemozleep.space; Secure'));
   const request = seen.at(-1);
   assert.equal(request.url, origin + '/api/submit?preserved=1');
   assert.equal(request.headers.origin, origin.replace('cdjstudio.xyz', 'emozleep.space'));
   assert.equal(request.headers.referer, origin + '/play?x=1');
   // Miniflare strips CF-Connecting-IP on outbound fetch. Cloudflare injects it
   // from x-real-ip for same-zone requests; the live D1 probe verifies that gate.
   assert.equal(request.headers['x-real-ip'], '203.0.113.10');
   assert.equal(request.headers['sec-fetch-site'], 'same-origin');
   assert.equal(request.headers.cookie, 'admin=fixture'); assert.equal(request.headers.authorization, 'Bearer local-fixture');
   assert.equal(request.body, '{invalid'); assert.equal(request.method, 'POST');
  }
  for (const origin of ['https://attacker.invalid', 'https://slidemino.cdjstudio.xyz.attacker.invalid', 'https://slidemino.emozleep.space']) {
   const response = await mf.dispatchFetch('https://slidemino.cdjstudio.xyz/api/submit', { method: 'POST', body: '{', headers: { origin } });
   assert.equal(response.status, 403);
  }
  const native = await mf.dispatchFetch('https://slidemino.cdjstudio.xyz/api/submit', { method: 'POST', body: '{', headers: { origin: 'capacitor://localhost' } });
  assert.equal(native.status, 400); assert.equal(native.headers.get('access-control-allow-origin'), 'capacitor://localhost');
  const preview = await mf.dispatchFetch('https://preview.workers.dev/api/submit', { method: 'POST' });
  assert.equal(preview.status, 503);
  const page = await mf.dispatchFetch('https://slidemino.cdjstudio.xyz/privacy');
  assert.equal(await page.text(), 'static fixture');
  console.log('PASS: both new origins, native origin, denied origins, same-host URL, x-real-ip/auth/body/Fetch Metadata/cookies, redirects, static and preview boundaries. Edge CF-Connecting-IP requires live D1 verification.');
 } finally { await mf.dispose(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
