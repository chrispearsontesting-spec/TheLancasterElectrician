var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// uploads-lib.js
var ALLOWED_ORIGINS = ["https://thelancasterelectrician.com", "https://www.thelancasterelectrician.com"];
var DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
var LIMITS = { maxFiles: 10, maxFileBytes: 10 * 1024 * 1024, maxJobBytes: 50 * 1024 * 1024, maxPendingJobs: 20, maxNote: 4e3, maxShort: 100 };
var ID_RE = /^[A-Za-z0-9_-]{22,43}$/;
var HASH_RE = /^[a-f0-9]{64}$/;
var JOB_RE = /^[a-z0-9]{8,12}-[a-f0-9]{8}$/;
var FILE_RE = /^f\d{1,2}\.(jpg|png|webp|heic|pdf)$/;
var MEM_WINDOW_MS = 6e4;
var memHits = /* @__PURE__ */ new Map();
function originAllowed(origin, env) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (DEV_ORIGIN.test(origin) && (env && env.ALLOW_LOCALHOST) !== "0") return true;
  const extra = String(env && env.EXTRA_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return extra.includes(origin);
}
__name(originAllowed, "originAllowed");
function memLimit(key, limit, now = Date.now()) {
  const rec = memHits.get(key);
  if (!rec || now - rec.start >= MEM_WINDOW_MS) {
    memHits.set(key, { start: now, n: 1 });
    if (memHits.size > 5e3) {
      for (const [k, v] of memHits) {
        if (now - v.start >= MEM_WINDOW_MS) memHits.delete(k);
      }
    }
    return true;
  }
  rec.n++;
  return rec.n <= limit;
}
__name(memLimit, "memLimit");
async function allow(req, env, kind) {
  const ip = req.headers.get("CF-Connecting-IP") || req.headers.get("X-Forwarded-For") || "unknown";
  const binding = kind === "write" ? env.UPLOAD_LIMITER : env.READ_LIMITER;
  if (binding && typeof binding.limit === "function") {
    try {
      const { success } = await binding.limit({ key: kind + ":" + ip });
      return success;
    } catch (e) {
    }
  }
  return memLimit(kind + ":" + ip, kind === "write" ? 10 : 120);
}
__name(allow, "allow");
async function sha256hex(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256hex, "sha256hex");
function sameHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
__name(sameHex, "sameHex");
function sniff(u8) {
  const s = /* @__PURE__ */ __name((i, str) => [...str].every((c, k) => u8[i + k] === c.charCodeAt(0)), "s");
  if (u8.length >= 3 && u8[0] === 255 && u8[1] === 216 && u8[2] === 255) return { ext: "jpg", type: "image/jpeg" };
  if (u8.length >= 8 && u8[0] === 137 && s(1, "PNG")) return { ext: "png", type: "image/png" };
  if (u8.length >= 12 && s(0, "RIFF") && s(8, "WEBP")) return { ext: "webp", type: "image/webp" };
  if (u8.length >= 12 && s(4, "ftyp") && ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].some((b) => s(8, b))) return { ext: "heic", type: "image/heic" };
  if (u8.length >= 5 && s(0, "%PDF-")) return { ext: "pdf", type: "application/pdf" };
  return null;
}
__name(sniff, "sniff");
function cleanText(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
}
__name(cleanText, "cleanText");
function cleanName(v) {
  return cleanText(v, 80).replace(/[\\/:*?"<>|]/g, "_") || "file";
}
__name(cleanName, "cleanName");
function newJobId(now) {
  const r = new Uint8Array(4);
  crypto.getRandomValues(r);
  return now.toString(36) + "-" + [...r].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(newJobId, "newJobId");
function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Owner-Key",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin"
  };
}
__name(cors, "cors");
function json(obj, status, h) {
  return new Response(JSON.stringify(obj), { status, headers: { ...h, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
__name(json, "json");
async function getReg(env, id) {
  const o = await env.UPLOADS.get("reg/" + id + ".json");
  if (!o) return null;
  try {
    return JSON.parse(await o.text());
  } catch (e) {
    return null;
  }
}
__name(getReg, "getReg");
async function ownerOk(req, env, id) {
  const key = req.headers.get("X-Owner-Key") || "";
  if (!ID_RE.test(key)) return false;
  const reg = await getReg(env, id);
  if (!reg) return false;
  return sameHex(await sha256hex(key), reg.h);
}
__name(ownerOk, "ownerOk");
async function listJobMetas(env, id) {
  const metas = [];
  let cursor;
  do {
    const page = await env.UPLOADS.list({ prefix: "job/" + id + "/", cursor });
    for (const o of page.objects) if (o.key.endsWith("/meta.json")) metas.push(o.key);
    cursor = page.truncated ? page.cursor : void 0;
  } while (cursor);
  return metas;
}
__name(listJobMetas, "listJobMetas");
async function handle(req, env) {
  const origin = req.headers.get("Origin") || "";
  if (!originAllowed(origin, env)) return json({ error: "Origin not allowed" }, 403, {});
  const h = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (!env.UPLOADS) return json({ error: "Storage not configured" }, 500, h);
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const route = parts[0] || "";
  const id = parts[1] || "";
  const write = req.method === "POST";
  if (!await allow(req, env, write ? "write" : "read")) return json({ error: "Too many requests, try again in a minute" }, 429, { ...h, "Retry-After": "60" });
  try {
    if (route === "register" && req.method === "POST" && parts.length === 1) {
      let body;
      try {
        body = await req.json();
      } catch (e) {
        return json({ error: "Bad JSON" }, 400, h);
      }
      const uid = String(body && body.uploadId || ""), hash = String(body && body.ownerKeyHash || "").toLowerCase();
      if (!ID_RE.test(uid) || !HASH_RE.test(hash)) return json({ error: "Bad uploadId or ownerKeyHash" }, 400, h);
      const reg = await getReg(env, uid);
      if (reg && !sameHex(reg.h, hash)) return json({ error: "Upload ID already registered" }, 409, h);
      await env.UPLOADS.put("reg/" + uid + ".json", JSON.stringify({ h: hash, t: Date.now(), c: reg ? reg.c : Date.now() }), { httpMetadata: { contentType: "application/json" } });
      return json({ ok: true, created: !reg }, reg ? 200 : 201, h);
    }
    if (!ID_RE.test(id)) return json({ error: "Not found" }, 404, h);
    if (route === "info" && req.method === "GET" && parts.length === 2) {
      const reg = await getReg(env, id);
      if (!reg) return json({ error: "This upload link is not active yet. Ask the owner to open Mechanic uploads in Dipstick." }, 404, h);
      return json({ ok: true, limits: LIMITS }, 200, h);
    }
    if (route === "upload" && req.method === "POST" && parts.length === 2) {
      const reg = await getReg(env, id);
      if (!reg) return json({ error: "This upload link is not active. Ask the owner for a new link." }, 404, h);
      const len = parseInt(req.headers.get("Content-Length") || "0", 10);
      if (len > LIMITS.maxJobBytes + 1024 * 1024) return json({ error: "Too big: 50 MB per upload max" }, 413, h);
      if (!/^multipart\/form-data/i.test(req.headers.get("Content-Type") || "")) return json({ error: "Expected multipart/form-data" }, 400, h);
      const pending = await listJobMetas(env, id);
      if (pending.length >= LIMITS.maxPendingJobs) return json({ error: "The owner has too many uploads waiting. Ask them to open Dipstick first." }, 429, h);
      let fd;
      try {
        fd = await req.formData();
      } catch (e) {
        return json({ error: "Could not read upload" }, 400, h);
      }
      const files = fd.getAll("file").filter((f) => f && typeof f === "object" && typeof f.arrayBuffer === "function");
      const note = cleanText(fd.get("note"), LIMITS.maxNote);
      if (!files.length && !note) return json({ error: "Add a photo, PDF or note" }, 400, h);
      if (files.length > LIMITS.maxFiles) return json({ error: "Max " + LIMITS.maxFiles + " files per upload" }, 400, h);
      let total = 0;
      const ready = [];
      for (const f of files) {
        if (f.size > LIMITS.maxFileBytes) return json({ error: cleanName(f.name) + " is over 10 MB" }, 413, h);
        total += f.size;
        if (total > LIMITS.maxJobBytes) return json({ error: "Too big: 50 MB per upload max" }, 413, h);
        const buf = new Uint8Array(await f.arrayBuffer());
        const kind = sniff(buf);
        if (!kind) return json({ error: cleanName(f.name) + " is not a photo or PDF" }, 415, h);
        ready.push({ buf, kind, name: cleanName(f.name) });
      }
      const mileageRaw = cleanText(fd.get("mileage"), 12).replace(/[,\s]/g, "");
      const mileage = /^\d{1,7}$/.test(mileageRaw) ? parseInt(mileageRaw, 10) : null;
      const now = Date.now();
      const jobId = newJobId(now);
      const base = "job/" + id + "/" + jobId + "/";
      const meta = {
        id: jobId,
        created: now,
        note,
        garage: cleanText(fd.get("garage"), LIMITS.maxShort),
        mechanic: cleanText(fd.get("mechanic"), LIMITS.maxShort),
        mileage,
        files: []
      };
      const written = [];
      try {
        for (let i = 0; i < ready.length; i++) {
          const r = ready[i];
          const key = "f" + i + "." + r.kind.ext;
          await env.UPLOADS.put(base + key, r.buf, { httpMetadata: { contentType: r.kind.type } });
          written.push(base + key);
          meta.files.push({ key, name: r.name, type: r.kind.type, size: r.buf.byteLength });
        }
        await env.UPLOADS.put(base + "meta.json", JSON.stringify(meta), { httpMetadata: { contentType: "application/json" } });
      } catch (e) {
        if (written.length) await env.UPLOADS.delete(written).catch(() => {
        });
        throw e;
      }
      return json({ ok: true, jobId, files: meta.files.length }, 201, h);
    }
    if (!["list", "file", "job"].includes(route)) return json({ error: "Not found" }, 404, h);
    if (!await ownerOk(req, env, id)) return json({ error: "Not allowed" }, 401, h);
    if (route === "list" && req.method === "GET" && parts.length === 2) {
      const keys = await listJobMetas(env, id);
      const jobs = [];
      for (const k of keys) {
        const o = await env.UPLOADS.get(k);
        if (o) {
          try {
            jobs.push(JSON.parse(await o.text()));
          } catch (e) {
          }
        }
      }
      jobs.sort((a, b) => a.created - b.created);
      return json({ jobs }, 200, h);
    }
    if (route === "file" && req.method === "GET" && parts.length === 4 && JOB_RE.test(parts[2]) && FILE_RE.test(parts[3])) {
      const o = await env.UPLOADS.get("job/" + id + "/" + parts[2] + "/" + parts[3]);
      if (!o) return json({ error: "Not found" }, 404, h);
      return new Response(o.body, { status: 200, headers: { ...h, "Content-Type": o.httpMetadata && o.httpMetadata.contentType || "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }
    if (route === "job" && req.method === "DELETE" && parts.length === 3 && JOB_RE.test(parts[2])) {
      const prefix = "job/" + id + "/" + parts[2] + "/";
      const keys = [];
      let cursor;
      do {
        const page = await env.UPLOADS.list({ prefix, cursor });
        for (const o of page.objects) keys.push(o.key);
        cursor = page.truncated ? page.cursor : void 0;
      } while (cursor);
      if (keys.length) await env.UPLOADS.delete(keys);
      return json({ ok: true, deleted: keys.length }, 200, h);
    }
    return json({ error: "Not found" }, 404, h);
  } catch (e) {
    return json({ error: "Server error" }, 500, h);
  }
}
__name(handle, "handle");

// uploads-worker.js
var uploads_worker_default = { fetch(req, env) {
  return handle(req, env);
} };

// ../../../../home/box/.local/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../home/box/.local/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-hpopfb/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = uploads_worker_default;

// ../../../../home/box/.local/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-hpopfb/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=uploads-worker.js.map
