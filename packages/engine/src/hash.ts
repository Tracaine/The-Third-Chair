import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
export function sha256Json(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
