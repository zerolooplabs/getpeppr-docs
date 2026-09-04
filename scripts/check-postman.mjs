/**
 * Parses the published Postman collection and checks it is importable.
 *
 * A collection that fails to parse — or that carries an item with no request
 * URL — imports as an empty or broken folder in Postman, which is exactly the
 * kind of defect nobody notices until someone tries to use it.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFound } from "./lib/markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = "postman/getpeppr.postman_collection.json";

let collection;
try {
  collection = JSON.parse(readFileSync(join(root, file), "utf8"));
} catch (err) {
  console.error(`  FAIL ${file}: ${err.message}`);
  process.exit(1);
}

const problems = [];
if (!collection.info?.name) problems.push("info.name is missing");
if (!collection.info?.schema) problems.push("info.schema is missing (Postman refuses the import)");

// Folders nest, so walk rather than iterate the top level.
const requests = [];
const walk = (items, trail) => {
  for (const item of items ?? []) {
    const path = [...trail, item.name ?? "(unnamed)"];
    if (Array.isArray(item.item)) walk(item.item, path);
    else if (item.request) requests.push({ path: path.join(" / "), request: item.request });
    else problems.push(`${path.join(" / ")}: neither a folder nor a request`);
  }
};
walk(collection.item, []);
assertFound(requests.length, 10, "Postman requests");

for (const { path, request } of requests) {
  const raw = typeof request.url === "string" ? request.url : request.url?.raw;
  if (!raw) problems.push(`${path}: request has no URL`);
  if (!request.method) problems.push(`${path}: request has no method`);
}

if (problems.length > 0) {
  console.error(`  FAIL ${file}`);
  for (const p of problems) console.error(`         ${p}`);
  process.exit(1);
}
console.log(`  ok   ${file} — ${requests.length} requests, schema ${collection.info.schema}`);
