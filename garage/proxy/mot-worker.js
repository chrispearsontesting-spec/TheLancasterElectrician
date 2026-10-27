// Dipstick MOT proxy (Cloudflare Worker entry). All logic lives in mot-lib.js;
// wrangler bundles it automatically on deploy.
import { handle } from "./mot-lib.js";

export default {
  fetch(req, env) {
    return handle(req, env);
  }
};
