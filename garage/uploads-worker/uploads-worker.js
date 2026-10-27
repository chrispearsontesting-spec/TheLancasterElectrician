// Dipstick mechanic uploads Worker entry. All logic lives in uploads-lib.js.
import { handle } from "./uploads-lib.js";
export default { fetch(req, env) { return handle(req, env); } };
