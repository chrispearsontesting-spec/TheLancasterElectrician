// Dipstick MOT proxy (Cloudflare Worker entry). All logic lives in mot-lib.js;
// wrangler bundles it automatically on deploy.
import { handle, refreshFuelCache } from "./mot-lib.js";

export default {
  fetch(req, env, ctx) {
    return handle(req, env, ctx);
  },
  scheduled(event, env, ctx) {
    ctx.waitUntil(refreshFuelCache(env));
  }
};
