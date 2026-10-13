// Bot ma termin waznosci: meta.stopAfter w config/products.json (data w
// czasie warszawskim, wlacznie). Po nim tor A wysyla pozegnanie i sam wylacza
// workflow, a skan i tor B koncza od razu, niczego nie zapisujac. Bez tego
// bot do kupienia jednego UPS-a mailowalby latami.

import { warsawParts } from "./digest.mjs";

export function isStopped(meta, nowMs) {
  if (!meta || !meta.stopAfter) return false;
  return warsawParts(nowMs).date > meta.stopAfter;
}

export function daysLeft(meta, nowMs) {
  if (!meta || !meta.stopAfter) return null;
  const today = Date.parse(warsawParts(nowMs).date + "T00:00:00Z");
  return Math.round((Date.parse(meta.stopAfter + "T00:00:00Z") - today) / 86400000);
}

// `node src/lifetime.mjs` wypisuje "stopped" albo "active" - czyta to workflow.
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "config", "products.json"), "utf8"));
  console.log(isStopped(cfg.meta, Date.now()) ? "stopped" : "active");
}
