# Mechanic uploads Worker (`dipstick-uploads`)

Separate from the MOT proxy. Lets a mechanic send photos/PDFs/notes for a car from `garage/upload.html`;
the owner's app (`garage/mechanic.html`, auto-check on `history.html`) downloads them into IndexedDB and deletes them here.

- R2 bucket `dipstick-uploads` (binding `UPLOADS`). Lifecycle: `job/` objects deleted after 14 days (backstop),
  `reg/` records (one tiny JSON per car link) deleted after 365 days unused.
- Each car gets a random upload ID (128-bit, public, in the QR/link) and an owner key (256-bit, stays on the phone).
  `POST /register {uploadId, ownerKeyHash}` stores only SHA-256 of the key. List/download/delete need `X-Owner-Key`.
- `GET /info/{id}`, `POST /upload/{id}` (multipart: `file` x up to 10, optional `title` per file in the same order (max 80 chars), `note`, `garage`, `mechanic`, `mileage`),
  `GET /list/{id}`, `GET /file/{id}/{job}/{fN.ext}`, `DELETE /job/{id}/{job}`.
- Limits: JPEG/PNG/WebP/HEIC/PDF only (checked by file bytes), 10 MB per file, 50 MB per upload, 20 waiting uploads per car.
- Origin allow-list: thelancasterelectrician.com (+www) and localhost. Per-IP limits: 10 writes/min (`UPLOAD_LIMITER`),
  120 reads/min (`READ_LIMITER`), in-memory fallback.

Tests: `node uploads-lib.test.mjs` (mock R2). Local dev: `wrangler dev` (local R2 simulation).

## Share for sale reports (`share-lib.js`)

Buyer-facing history reports made in `garage/share.html`, read at `garage/report.html?r=<id>`.
- `POST /share` (app origins only, `UPLOAD_LIMITER`): multipart `report` (JSON, max 256 KB) + `file` x up to 40 (+ `title` each), 25 MB total, 10 MB per file,
  same byte sniffing as uploads. Stored under `share/{id}/` (id 128-bit). Returns `{id, revokeKey (256-bit), expires}`; only SHA-256 of the key is stored.
- `GET /share/{id}` and `GET /share/{id}/file/{n}`: public by link (any origin, `READ_LIMITER`), `nosniff`, `X-Robots-Tag: noindex`.
- `DELETE /share/{id}` with `X-Revoke-Key` (app origins only): deletes files, leaves a tiny tombstone so buyers see "withdrawn".
- Expiry 30 days: checked in code (410 + wipe) and R2 lifecycle rule `delete-shares-after-30-days` on `share/`.

Tests: `npm test` (runs both suites).

## Link controls (phase 2)

Owner-only routes (need `X-Owner-Key`):

- `POST /settings/{id}` `{paused?: bool, code?: "1234" | ""}`: pause/resume uploads, set/change/clear the 4-digit job code. Only `sha256(id + ":" + code)` is stored in `reg/{id}.json` (`ch`). Changing settings clears any lockout.
- `POST /retire/{id}`: "New link". Tombstones the reg record (`retired: true`). Mechanic routes (`/info`, `/code`, `/upload`, `/transcribe`, `/register`) then answer 410 straight away; the owner key still works for `/list`, `/file` and `DELETE /job` so pending jobs can be collected. The app collects pending jobs before and after retiring, then registers a fresh ID/key and carries pause/code over.

Mechanic side:

- `GET /info/{id}` → `{paused, needCode, locked}`.
- `POST /code/{id}` `{code}`: cheap check. `/upload` and `/transcribe` also check the `X-Job-Code` header.
- Paused → 423. Wrong code → 403 with tries left. 5 wrong tries within 15 minutes lock that ID for 15 minutes (`lock/{id}.json`, any IP) → 429. A missing code doesn't count as a try. Per-IP limiters still apply.

Tests: `controls.test.mjs` (run by `npm test`).

## Show mode (`show-lib.js`)
The same sticker/QR can show a public car card instead of the mechanic upload form.
- `POST /show` (app origin) → `{showId, showKey}`; only `sha256(showKey)` is stored in `show/{sid}/meta.json`.
- `POST /show/{sid}/photo` / `clip` (X-Show-Key, raw body): sniffed JPEG/PNG/WebP (≤1.5 MB each, 15 MB total, phone shrinks to ~200 KB) and MP4/WebM clips (2 max, 20 MB total).
- `PUT /show/{sid}` (X-Show-Key): whitelisted, sanitised card → `show/{sid}/card.json`; files the card no longer uses are deleted.
- `DELETE /show/{sid}` = Unpublish: deletes everything for that showcase. `DELETE /show/{sid}/f/{name}` removes one file.
- Public: `GET /show/{sid}` (card, 60 s cache) and `GET /show/{sid}/f/{name}` (immutable, nosniff, Range for clips). 404 until published.
- Owner: `GET|POST /mode/{uploadId}` (X-Owner-Key) `{mode:"show"|"mechanic", showId?, showKey?}`; the showcase key is checked so a sticker can only point at its own showcase.
  In Show mode `/info` and `/resolve` return only `{ok, mode:"show", showId}`; upload, transcribe and code checks answer 423 `{state:"show"}`.
- No lifecycle rule on `show/`: a published card stays until Unpublish. Photo/clip uploads use the 120/min limiter (key `show-file:`), other writes the 10/min one.
