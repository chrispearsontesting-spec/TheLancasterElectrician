// Unit tests for Show mode: showcase create/publish/unpublish, file caps + sniffing, sanitising, sticker mode switch. Run: node show-lib.test.mjs
import assert from "node:assert/strict";
import worker from "./uploads-worker.js";
import { _resetForTests, sha256hex } from "./uploads-lib.js";
import { social, sanitizeCard, youtubeId, playlist, httpsImage, instaHandle, SHOW } from "./show-lib.js";
class MockR2 {
  constructor() { this.m = new Map(); this.failPutAfter = Infinity; this.puts = 0; }
  async put(k, v, o = {}) {
    if (++this.puts > this.failPutAfter) throw new Error("boom");
    const buf = typeof v === "string" ? new TextEncoder().encode(v) : new Uint8Array(v);
    this.m.set(k, { buf, httpMetadata: o.httpMetadata || {} });
  }
  async get(k) {
    const r = this.m.get(k); if (!r) return null;
    return { httpMetadata: r.httpMetadata, body: new Blob([r.buf]).stream(), text: async () => new TextDecoder().decode(r.buf) };
  }
  async list({ prefix = "", cursor } = {}) {
    const keys = [...this.m.keys()].filter(k => k.startsWith(prefix)).sort();
    const start = cursor ? parseInt(cursor, 10) : 0, page = keys.slice(start, start + 3);
    const truncated = start + 3 < keys.length;
    return { objects: page.map(key => ({ key })), truncated, cursor: truncated ? String(start + 3) : undefined };
  }
  async delete(k) { for (const x of [].concat(k)) this.m.delete(x); }
}
const SITE = "https://thelancasterelectrician.com", W = "https://w.dev";
const UID = "AbCdEfGhIjKlMnOpQrStUv", KEY = "OwnerKeyOwnerKeyOwnerKeyOwnerKeyOwnerKey123";
const UID2 = "ZyXwVuTsRqPoNmLkJiHgFe", KEY2 = "NewKeyNewKeyNewKeyNewKeyNewKeyNewKeyNewKey1";
const jpg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const webm = () => { const a = new Uint8Array(400); a.set([0x1a, 0x45, 0xdf, 0xa3]); return a; };
let env, ip = 1;
const fresh = () => { _resetForTests(); env = { UPLOADS: new MockR2(), AI: { run: async () => ({ text: "front pads done" }) } }; };
const call = (method, path, { origin = SITE, body, headers = {}, ipAddr } = {}) =>
  worker.fetch(new Request(W + path, { method, body, headers: { ...(origin ? { Origin: origin } : {}), "CF-Connecting-IP": ipAddr || ("10.2.0." + (ip++ % 250)), ...headers } }), env);
const register = (uid = UID, key = KEY) => sha256hex(key).then(h => call("POST", "/register", { body: JSON.stringify({ uploadId: uid, ownerKeyHash: h }), headers: { "Content-Type": "application/json" } }));
const upload = (code, uid = UID) => { const fd = new FormData(); fd.append("file", new Blob([jpg()]), "a.jpg"); fd.append("note", "x"); return call("POST", "/upload/" + uid, { body: fd, headers: code != null ? { "X-Job-Code": code } : {} }); };
const tx = (code) => call("POST", "/transcribe/" + UID, { body: webm(), headers: { "Content-Type": "audio/webm", ...(code != null ? { "X-Job-Code": code } : {}) } });
const reg = async (uid = UID) => JSON.parse(await (await env.UPLOADS.get("reg/" + uid + ".json")).text());
const info = () => call("GET", "/info/" + UID).then(r => r.json());
let pass = 0; const t = async (name, fn) => { await fn(); pass++; console.log("ok -", name); };
const settings = (body, key = KEY, uid = UID) => call("POST", "/settings/" + uid, { body: JSON.stringify(body), headers: { "X-Owner-Key": key, "Content-Type": "application/json" } });
const png = (n = 100) => { const a = new Uint8Array(n); a.set([0x89, 0x50, 0x4e, 0x47]); return a; };
const mp4 = (n = 100) => { const a = new Uint8Array(n); a.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]); return a; };
const heic = () => { const a = mp4(); a.set([0x68, 0x65, 0x69, 0x63], 8); return a; };
const create = async () => (await call("POST", "/show")).json();
const sk = (s) => ({ "X-Show-Key": s.showKey });
const photo = (s, body = jpg()) => call("POST", "/show/" + s.showId + "/photo", { body, headers: sk(s) });
const clip = (s, body = mp4()) => call("POST", "/show/" + s.showId + "/clip", { body, headers: sk(s) });
const publish = (s, card) => call("PUT", "/show/" + s.showId, { body: JSON.stringify(card), headers: { ...sk(s), "Content-Type": "application/json" } });
const pub = (path) => call("GET", path, { origin: "" });
const mode = (body, key = KEY) => call("POST", "/mode/" + UID, { body: JSON.stringify(body), headers: { "X-Owner-Key": key, "Content-Type": "application/json" } });

await t("parsers: YouTube ids, playlists, images, Instagram", async () => {
  assert.equal(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://youtu.be/dQw4w9WgXcQ?si=x"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://m.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://evil.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(youtubeId("javascript:alert(1)//dQw4w9WgXcQ"), null);
  assert.deepEqual(playlist("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc"), { kind: "spotify", type: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M" });
  assert.deepEqual(playlist("https://music.youtube.com/playlist?list=PLabcdefghij123"), { kind: "ytmusic", id: "PLabcdefghij123" });
  assert.equal(playlist("https://open.spotify.com.evil.com/playlist/37i9dQZF1DXcBWIGoYBM5M"), null);
  assert.equal(playlist("http://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"), null);
  assert.equal(httpsImage("https://i.imgur.com/abc.jpg"), "https://i.imgur.com/abc.jpg");
  assert.equal(httpsImage("http://i.imgur.com/abc.jpg"), null);
  assert.equal(httpsImage("javascript:alert(1)"), null);
  assert.equal(httpsImage("https://user:pw@x.com/a.jpg"), null);
  assert.equal(instaHandle("@my.car_23"), "my.car_23");
  assert.equal(instaHandle("https://www.instagram.com/my.car/"), "my.car");
  assert.equal(instaHandle("<script>"), null);
});
await t("sanitizeCard: whitelist only, no HTML, plate hidden on request, unknown files dropped", async () => {
  const c = sanitizeCard({ evil: 1, title: "<b>Hi</b>", basics: { make: "Ford", model: "Focus ST", year: "2019", plate: "ab12 cde", hidePlate: true },
    stats: { bhp: "280", torque: 9999, zero60: "5.71", best: { time: "13.2s", label: "1/4 mile", venue: "Santa Pod" } },
    mods: [{ name: "Remap", notes: "Stage 1" }, { name: "" }], story: "Line1\n\n\n\nLine2<img>",
    gallery: [{ n: "pabcdefghijkl.jpg" }, { n: "pzzzzzzzzzzzz.jpg" }, { url: "https://x.com/a.jpg", cap: "c" }, { url: "data:image/png;base64,AA" }], hero: 5,
    videos: ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ", "nope"], instagram: "@me" }, { "pabcdefghijkl.jpg": 10 });
  assert.equal(c.evil, undefined); assert.equal(c.title, "b Hi /b");
  assert.equal(c.basics.plate, undefined); assert.equal(c.basics.year, 2019);
  assert.equal(c.stats.bhp, 280); assert.equal(c.stats.torque, null); assert.equal(c.stats.zero60, 5.71);
  assert.equal(c.mods.length, 1); assert.equal(c.story, "Line1\n\nLine2 img");
  assert.deepEqual(c.gallery, [{ n: "pabcdefghijkl.jpg", cap: "" }, { url: "https://x.com/a.jpg", cap: "c" }]);
  assert.equal(c.hero, 0); assert.deepEqual(c.videos, [{ id: "dQw4w9WgXcQ", title: "" }]); assert.equal(c.instagram, "me");
  assert.equal(sanitizeCard({ basics: { plate: "ab12 cde" } }, {}).basics.plate, "AB12CDE");
});
await t("socials: Instagram/Facebook allowlist, titles, dedupe, no CDN hotlinks", async () => {
  assert.deepEqual(social("https://www.instagram.com/reel/C8abcDEF123/?igsh=x"), { kind: "ig", type: "reel", code: "C8abcDEF123" });
  assert.equal(social("https://www.facebook.com/plugins/post.php?href=x"), null);
  assert.equal(social("https://scontent.cdninstagram.com/v/x.jpg"), null);
  assert.equal(social("https://instagram.com.evil.com/p/C8abcDEF123/"), null);
  assert.equal(social("http://www.instagram.com/p/C8abcDEF123/"), null);
  assert.equal(social("https://www.facebook.com/permalink.php"), null);
  assert.equal(social("https://www.facebook.com/x/posts/1?__cft__=<script>").href, "https://www.facebook.com/x/posts/1");
  const c = sanitizeCard({ videos: [{ url: "https://youtube.com/shorts/dQw4w9WgXcQ", title: "<i>Launch</i>" }, "https://www.youtube.com/live/dQw4w9WgXcQ"],
    socials: [{ url: "https://www.instagram.com/p/C8abcDEF123/", title: "Meet" }, "https://instagram.com/p/C8abcDEF123", "https://fb.watch/abcDEF12/", "javascript:x"] }, {});
  assert.deepEqual(c.videos, [{ id: "dQw4w9WgXcQ", title: "i Launch /i" }]);
  assert.equal(c.socials.length, 2); assert.equal(c.socials[0].title, "Meet"); assert.equal(c.socials[1].type, "video");
});
await t("create needs app origin; writes need the show key", async () => {
  fresh();
  assert.equal((await call("POST", "/show", { origin: "https://evil.com" })).status, 403);
  const s = await create(); assert.match(s.showId, /^[A-Za-z0-9_-]{22}$/);
  const meta = JSON.parse(await (await env.UPLOADS.get("show/" + s.showId + "/meta.json")).text());
  assert.equal(meta.h, await sha256hex(s.showKey)); assert.ok(!JSON.stringify(meta).includes(s.showKey), "only hash stored");
  assert.equal((await photo({ showId: s.showId, showKey: "x".repeat(43) })).status, 401);
  assert.equal((await publish({ showId: s.showId, showKey: "y".repeat(43) }, {})).status, 401);
});
await t("photos: sniffed, per-file and total caps; clips separate with 20 MB budget", async () => {
  fresh(); const s = await create();
  assert.equal((await photo(s)).status, 201); assert.equal((await photo(s, png())).status, 201);
  assert.equal((await photo(s, new TextEncoder().encode("<svg onload=alert(1)>"))).status, 415);
  assert.equal((await photo(s, mp4())).status, 415, "video sent as photo");
  assert.equal((await photo(s, new Uint8Array(SHOW.maxPhotoBytes + 1).fill(0xff))).status, 413);
  assert.equal((await clip(s, heic())).status, 415);
  assert.equal((await clip(s, jpg())).status, 415);
  const c = await clip(s); assert.equal(c.status, 201); assert.match((await c.json()).name, /^c[a-z0-9]{12}\.mp4$/);
  const big = mp4(SHOW.maxClipTotal); const r = await clip(s, big); assert.equal(r.status, 413); assert.match((await r.json()).error, /YouTube/);
  // total photo budget
  const m = JSON.parse(await (await env.UPLOADS.get("show/" + s.showId + "/meta.json")).text());
  m.files["paaaaaaaaaaaa.jpg"] = SHOW.maxPhotoTotal - 10; await env.UPLOADS.put("show/" + s.showId + "/meta.json", JSON.stringify(m));
  const full = await photo(s); assert.equal(full.status, 413); assert.match((await full.json()).error, /15 MB/);
});
await t("publish: public card + photos readable, unused files removed, not before publish", async () => {
  fresh(); const s = await create();
  const a = (await (await photo(s)).json()).name, b = (await (await photo(s, png())).json()).name;
  assert.equal((await pub("/show/" + s.showId)).status, 404);
  assert.equal((await pub("/show/" + s.showId + "/f/" + a)).status, 404, "files hidden until published");
  const r = await publish(s, { title: "My ST", gallery: [{ n: a, cap: "Front" }], videos: ["dQw4w9WgXcQ"] });
  assert.equal(r.status, 200); assert.equal((await r.json()).removed, 1);
  const g = await pub("/show/" + s.showId); assert.equal(g.status, 200); assert.match(g.headers.get("Cache-Control"), /max-age=60/);
  assert.equal(g.headers.get("X-Robots-Tag"), "noindex, nofollow");
  const card = await g.json(); assert.equal(card.title, "My ST"); assert.equal(card.gallery[0].n, a);
  const f = await pub("/show/" + s.showId + "/f/" + a); assert.equal(f.status, 200);
  assert.equal(f.headers.get("Content-Type"), "image/jpeg"); assert.equal(f.headers.get("X-Content-Type-Options"), "nosniff"); assert.match(f.headers.get("Cache-Control"), /immutable/);
  assert.equal((await pub("/show/" + s.showId + "/f/" + b)).status, 404, "unused photo deleted");
  assert.equal((await pub("/show/" + s.showId + "/f/..%2Fmeta.json")).status, 404);
  assert.equal((await pub("/show/" + s.showId + "/meta.json")).status, 404);
  assert.equal((await call("PUT", "/show/" + s.showId, { body: "x".repeat(SHOW.maxCardBytes + 1), headers: sk(s) })).status, 413);
});
await t("unpublish wipes everything; key stops working", async () => {
  fresh(); const s = await create(); const a = (await (await photo(s)).json()).name;
  await publish(s, { gallery: [{ n: a }] });
  const d = await call("DELETE", "/show/" + s.showId, { headers: sk(s) }); assert.equal(d.status, 200);
  assert.equal([...env.UPLOADS.m.keys()].filter(k => k.startsWith("show/")).length, 0);
  const g = await pub("/show/" + s.showId); assert.equal(g.status, 404); assert.equal((await g.json()).state, "unpublished");
  assert.equal((await photo(s)).status, 401);
});
await t("mode switch: owner key + own show key needed; sticker resolves to showcase; uploads refused; back to mechanic works", async () => {
  fresh(); await register(); const s = await create(); await publish(s, { title: "x" });
  assert.equal((await upload()).status, 201, "mechanic mode upload works");
  assert.equal((await mode({ mode: "show" })).status, 409, "no showcase yet");
  assert.equal((await mode({ mode: "show", showId: s.showId, showKey: s.showKey }, "x".repeat(43))).status, 401);
  assert.equal((await mode({ mode: "show", showId: s.showId, showKey: "z".repeat(43) })).status, 400, "someone else's showcase");
  assert.equal((await mode({ mode: "party" })).status, 400);
  const r = await mode({ mode: "show", showId: s.showId, showKey: s.showKey }); assert.equal(r.status, 200);
  const i = await info(); assert.deepEqual(i, { ok: true, mode: "show", showId: s.showId }, "no limits / paused / code leaked");
  assert.deepEqual(await (await call("GET", "/resolve/" + UID)).json(), i);
  const u = await upload(); assert.equal(u.status, 423); assert.equal((await u.json()).state, "show");
  assert.equal((await tx()).status, 423);
  assert.equal((await mode({ mode: "mechanic" })).status, 200);
  const i2 = await info(); assert.equal(i2.mode, "mechanic"); assert.equal(i2.paused, false);
  assert.equal((await upload()).status, 201);
  assert.equal((await reg()).show, s.showId, "showcase remembered for next time");
  assert.equal((await mode({ mode: "show" })).status, 200, "switch back without resending the key");
  // re-register (app reopen) keeps the mode
  await register(); assert.equal((await info()).mode, "show");
});
await t("pause + code settings still apply in mechanic mode only; a retired ID drops the mode", async () => {
  fresh(); await register(); const s = await create(); await publish(s, {});
  await settings({ paused: true }); await mode({ mode: "show", showId: s.showId, showKey: s.showKey });
  assert.equal((await info()).mode, "show", "show mode wins over pause");
  await call("POST", "/retire/" + UID, { headers: { "X-Owner-Key": KEY } });
  assert.equal((await call("GET", "/info/" + UID)).status, 410);
  assert.equal((await mode({ mode: "show" })).status, 410);
});
await t("CORS: public GET allowed from anywhere, preflight from app allows X-Show-Key + PUT", async () => {
  fresh();
  const p = await call("OPTIONS", "/show/abc"); assert.equal(p.status, 204);
  assert.match(p.headers.get("Access-Control-Allow-Headers"), /X-Show-Key/); assert.match(p.headers.get("Access-Control-Allow-Methods"), /PUT/);
  const g = await pub("/show/AbCdEfGhIjKlMnOpQrStUv"); assert.equal(g.headers.get("Access-Control-Allow-Origin"), "*");
});
console.log("\n" + pass + " show tests passed");
