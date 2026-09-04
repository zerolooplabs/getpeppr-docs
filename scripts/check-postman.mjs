/**
 * Checks the published Postman collection is structurally sound.
 *
 * What this proves: the file is valid JSON, it declares the Collection v2.1
 * schema Postman requires, every leaf is a request with a method and a URL, and
 * no request carries a `prerequest` or `test` script — a collection people
 * import runs those on their own machine, so one arriving here should be a
 * deliberate, reviewed decision rather than a silent addition.
 *
 * What it does NOT prove: that Postman imports it. Nothing short of running
 * Postman or Newman proves that, and neither is worth pulling into a
 * secret-free public workflow. `check:routes` separately checks every URL in
 * this file against the published spec, method included.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFound, safe } from "./lib/markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = "postman/getpeppr.postman_collection.json";
const V21_SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

let collection;
try {
  collection = JSON.parse(readFileSync(join(root, file), "utf8"));
} catch (err) {
  console.error(`  FAIL ${file}`);
  console.error(`  - ${safe(err.message)}`);
  process.exit(1);
}

const problems = [];
if (!collection.info?.name) problems.push("info.name is missing");
// Checked against the exact schema URL, not merely for a non-empty string:
// Postman refuses an import whose schema it does not recognise.
if (collection.info?.schema !== V21_SCHEMA) {
  problems.push(`info.schema is ${safe(JSON.stringify(collection.info?.schema))}, expected ${V21_SCHEMA}`);
}

const requests = [];
(function walk(items, trail) {
  for (const item of items ?? []) {
    const path = [...trail, item.name ?? "(unnamed)"];
    if (Array.isArray(item.item)) walk(item.item, path);
    else if (item.request) requests.push({ path: path.join(" / "), item });
    else problems.push(`${safe(path.join(" / "))}: neither a folder nor a request`);
  }
})(collection.item, []);
// 30 requests today. A minimum of 10 would let two thirds of the collection
// disappear in the green.
assertFound(requests.length, 25, "Postman requests");

for (const { path, item } of requests) {
  const raw = typeof item.request.url === "string" ? item.request.url : item.request.url?.raw;
  if (!raw) problems.push(`${safe(path)}: request has no URL`);
  if (!item.request.method) problems.push(`${safe(path)}: request has no method`);
  for (const event of item.event ?? []) {
    problems.push(`${safe(path)}: carries a ${safe(event.listen)} script, which runs on the importer's machine`);
  }
}

if (problems.length > 0) {
  console.error(`  FAIL ${file}`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`  ok   ${file} — ${requests.length} requests, Collection v2.1, no embedded scripts`);
