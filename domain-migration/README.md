# cdjstudio.xyz domain migration

This adapter preserves the existing Pages Functions deployment and its 21 API
routes, including private admin, analytics and gift handlers excluded from Git.
Do not deploy a static-only replacement to the `slidemino` Pages project.

The static artifact is derived from deployment
`988d5b4a-e777-43fc-b902-c82fbe5970d0`. All 33 original files were matched to the
Cloudflare deployment manifest. `artifact.json` records their SHA-256 values.
Only domain literals and JavaScript filenames/references for cache invalidation
change. Run `python3 domain-migration/prepare.py` to reproduce `dist`.

The Worker serves those assets and forwards `/api/*` to the existing Pages
application on the **same hostname**. The two new web Origins are translated to
the existing backend's compatibility identifiers; no network request uses the
retired hostname. Native and untrusted Origins, request bodies, credentials and
Fetch Metadata retain the original backend policy. Incoming retired web Origins
are rejected. Response CORS, redirect hosts and cookie Domain attributes are
mapped back to the new domain without changing API bodies or cookie flags.

Use Miniflare 4 to run `node domain-migration/worker.runtime-check.cjs`. A caller can set
`MINIFLARE_MODULE` to an installed module path and `MINIFLARE_WORKERD_PATH` to a
workerd binary supporting compatibility date `2026-09-03`. The local test checks
transport and origin boundaries. Cloudflare's same-zone client IP behavior needs
an additional live check against only the tester's existing D1 rate-limit key.
The migration verification did not create a score, gift or analytics event.

For first creation, run Wrangler dry-run and deploy with
`--config domain-migration/wrangler.jsonc`. Verify the Workers preview's 33 files
against the artifact manifest, then attach these separate zone routes:

- `slidemino.cdjstudio.xyz/*`
- `www.slidemino.cdjstudio.xyz/*`

The original Pages custom domains must remain attached. Requests under
`workers.dev/api/*` receive 503. Confirm `x-cdj-domain-migration: slidemino-v1`
before evaluating live API checks because route propagation is asynchronous.
New/native Origin malformed JSON requests must return 400; untrusted and retired
Origins must return 403. Confirm browser CORS and the caller's client-IP counter.

Rollback removes only these two routes; it leaves the original Pages deployment,
bindings, secrets and database intact. Replacing this adapter with a full Pages
build requires recovering and validating all private source routes first.

References: [Cloudflare's same-host Pages proxy](https://developers.cloudflare.com/pages/how-to/add-custom-http-headers/)
and [same-zone request headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/).

For later Worker code updates, use `wrangler versions upload` and promote the
returned version ID with `wrangler versions deploy`; preserve the two existing
zone routes. Do not let a routine code upload replace routing configuration.
