# MOT History proxy

GitHub Pages cannot hide secrets. This Cloudflare Worker holds the DVSA keys and the app only calls the Worker.

Files:
- `mot-worker.js`: Worker entry (tiny, just calls `handle`).
- `mot-lib.js`: all logic (origin check, rate limit, token cache, DVSA call, tax check).
- `wrangler.toml`: Worker name plus the `MOT_LIMITER` rate-limit binding.

What it does:
- **Origin lock.** It only answers `https://thelancasterelectrician.com` (and `www.`), plus `http://localhost:*` / `http://127.0.0.1:*` for testing. Anything else, including a plain browser visit or `curl` with no `Origin` header, gets **403**.
  - Optional Worker variables: `ALLOW_LOCALHOST=0` turns localhost off. `EXTRA_ORIGINS=https://a.example,https://b.example` adds more sites.
- **Rate limit.** 20 lookups per minute per IP address, using Cloudflare's Rate Limiting binding `MOT_LIMITER` (approximate, counted per Cloudflare location). If the binding is missing, a weaker in-memory counter is used; it resets whenever Cloudflare recycles the Worker.
- **Token cache.** The DVSA token is kept in memory and reused until 2 minutes before it expires, so there is no new Microsoft login on every lookup. A 401 from DVSA drops the token and retries once.

## Deploy the update (owner, on a laptop with Wrangler)

You already have the Worker `dipstick-mot` and its secrets. The secrets stay as they are; you only redeploy the code.

1. Get this branch's files onto the laptop (`garage/proxy/` folder: `mot-worker.js`, `mot-lib.js`, `wrangler.toml`).
2. Make sure Wrangler is new enough for rate limits (4.36.0 or later):
   ```
   npm install -g wrangler@latest
   wrangler --version
   wrangler login
   ```
3. Deploy from the folder:
   ```
   cd garage/proxy
   wrangler deploy
   ```
   Wrangler bundles `mot-lib.js` into the Worker and creates the `MOT_LIMITER` binding from `wrangler.toml`. If it says `namespace_id 1001` is already used in your account by something else, change it to any other whole number (e.g. `"2001"`) and deploy again.
4. Check the secrets are still there (no values are shown):
   ```
   wrangler secret list
   ```
   You should see `DVSA_CLIENT_ID`, `DVSA_CLIENT_SECRET`, `DVSA_TOKEN_URL`, `DVSA_API_KEY` (and `DVSA_SCOPE` if you set it). If any are missing, add them with `wrangler secret put NAME`.
5. Test (see below).

**Cloudflare dashboard instead of Wrangler.** The dashboard editor can't create the rate-limit binding from `wrangler.toml`, so Wrangler is the recommended way.
- If you must use the dashboard: open Workers & Pages, then `dipstick-mot`, then Edit code. Add a file named `mot-lib.js` and paste its contents, replace `mot-worker.js` with the new one, and Deploy.
- Without the binding the Worker still works but only has the in-memory fallback limit.

To roll back, use Workers & Pages → `dipstick-mot` → Deployments → pick the previous version → Rollback.

## Test after deploying

- Open `https://thelancasterelectrician.com/garage/home.html`. Tap ✎, then Lookup on the car's plate. Make, model and fuel should fill in.
- Opening the Worker URL directly in a browser (`https://dipstick-mot.YOURNAME.workers.dev/?plate=SB61LGZ`) should now show `{"error":"Origin not allowed"}`. That is expected and means the lock works.
- With curl, pretending to be the site:
  ```
  curl -H "Origin: https://thelancasterelectrician.com" "https://dipstick-mot.YOURNAME.workers.dev/?plate=SB61LGZ"
  ```
  should return the MOT JSON. Remember that `Origin` can be faked by scripts, so the origin lock stops other websites using your key from browsers. The rate limit is what slows down scripts.

## First-time setup (only if starting from scratch)

1. Create a free Cloudflare account: https://dash.cloudflare.com/sign-up
2. `npm install -g wrangler@latest` and `wrangler login`
3. `cd garage/proxy` then `wrangler deploy`. The first deploy gives a URL like `https://dipstick-mot.YOURNAME.workers.dev`.
4. Put the DVSA secrets on the Worker (never commit these):
   ```
   wrangler secret put DVSA_CLIENT_ID
   wrangler secret put DVSA_CLIENT_SECRET
   wrangler secret put DVSA_TOKEN_URL
   wrangler secret put DVSA_API_KEY
   ```
   - `DVSA_TOKEN_URL` is the full Microsoft login URL from the DVSA email (`https://login.microsoftonline.com/TENANT/oauth2/v2.0/token`).
   - Optional, if DVSA gave a different scope: `wrangler secret put DVSA_SCOPE`. The default scope is `https://tapi.dvsa.gov.uk/.default`.
5. Set `window.MOT_PROXY` in `garage/mot-config.js` to the Worker URL. Commit that one line only, no keys.

## Keep the key alive

DVSA revokes keys after 90 days of no use. Looking up a plate in the app counts as use. The home page now re-checks each car's MOT at most once every 7 days, so open the app and tap Lookup now and then if you rarely add cars.

## Local tests

The Worker logic is tested with mocked `fetch` (no DVSA calls):
```
cd garage/proxy
node mot-lib.test.mjs
```
It needs Node 18 or later, and nothing to install.
