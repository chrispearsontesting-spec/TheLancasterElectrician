# MOT History proxy

GitHub Pages cannot hide secrets. This Cloudflare Worker holds the DVSA keys and the app only calls the Worker.

## 1. Create a free Cloudflare account

https://dash.cloudflare.com/sign-up

## 2. Install Wrangler (on a laptop)

```
npm install -g wrangler
wrangler login
```

## 3. From this folder

```
cd garage/proxy
wrangler deploy
```

First deploy creates a URL like:
`https://dipstick-mot.YOURNAME.workers.dev`

## 4. Put the DVSA secrets on the Worker

Do this on the laptop. Never commit these.

```
wrangler secret put DVSA_CLIENT_ID
wrangler secret put DVSA_CLIENT_SECRET
wrangler secret put DVSA_TOKEN_URL
wrangler secret put DVSA_API_KEY
```

`DVSA_TOKEN_URL` is the full Microsoft login URL from the DVSA email
(`https://login.microsoftonline.com/TENANT/oauth2/v2.0/token`).

Optional if DVSA gave a different scope:
```
wrangler secret put DVSA_SCOPE
```
Default scope is `https://tapi.dvsa.gov.uk/.default`.

## 5. Point the app at the Worker

Edit `garage/mot-config.js` and set:

```
window.MOT_PROXY = "https://dipstick-mot.YOURNAME.workers.dev";
```

Commit that one line only. No keys.

## 6. Test

Open:
`https://dipstick-mot.YOURNAME.workers.dev/?plate=SB61LGZ`

You should see JSON (make, tests, mileage). Then hard-refresh the buying guide.

## 7. Keep the key alive

DVSA revokes keys after 90 days of no use. Looking up a plate in the app counts as use.
