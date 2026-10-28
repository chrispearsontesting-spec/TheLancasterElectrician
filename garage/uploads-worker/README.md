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
