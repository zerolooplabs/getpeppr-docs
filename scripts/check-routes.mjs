/**
 * Every API path this repository cites must exist in the OpenAPI spec getpeppr
 * publishes. This is the check GPR-1261 was missing: a route that had been
 * removed stayed cited twelve times across the examples, the READMEs and the
 * Postman collection until a human audit read them.
 *
 * The spec is downloaded from the public site — no key, no authenticated call.
 * If it cannot be reached the check SKIPS with a warning rather than failing:
 * its job is to catch our mistakes, not to monitor the marketing site (uptime
 * has its own monitor). A CI that reddens for someone else's outage gets
 * ignored, and then it catches nothing at all.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFound } from "./lib/markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_URL = process.env.SPEC_URL ?? "https://getpeppr.dev/openapi.yaml";

/** Top-level keys of the `paths:` block, e.g. `/invoices/{id}/as/{format}`. */
function specPaths(yaml) {
  const lines = yaml.split("\n");
  const start = lines.findIndex((l) => /^paths:\s*$/.test(l));
  if (start === -1) throw new Error("no `paths:` block in the spec");
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\S/.test(line)) break; // back to a top-level key: the block ended
    const m = /^ {2}(\/\S*?):\s*$/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

/** `/v1/invoices/inv_abc/as/pdf` and `{{base_url}}/v1/contacts/:id` alike. */
function normalize(raw) {
  let path = raw
    .replace(/^\{\{[^}]+\}\}/, "")
    .replace(/^https?:\/\/[^/]+/, "")
    .split(/[?#]/)[0]
    .replace(/\/+$/, "");
  if (!path.startsWith("/v1/")) return null;
  path = path.slice(3); // the spec's paths are relative to the /v1 server URL

  // `GET /v1/directory/0208:BE0456789012` — the colon form of a participant id.
  // The handler accepts it (probed against the sandbox on 2026-09-04: it reached
  // the handler and normalised to the same participant as the slash form), but
  // the published spec only declares the two-segment form. Rewrite rather than
  // report, so this check stays about routes that do not exist.
  path = path.replace(/^\/directory\/([^/:]+):([^/]+)$/, "/directory/$1/$2");

  return path;
}

const isParam = (seg) => /^[:{]/.test(seg);

function matches(cited, template) {
  const a = cited.split("/");
  const b = template.split("/");
  if (a.length !== b.length) return false;
  return a.every((seg, i) => isParam(b[i]) || isParam(seg) || seg === b[i]);
}

// ---------------------------------------------------------------- citations

function walkFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "__pycache__") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkFiles(full, acc);
    else if (/\.(md|ts|py)$/.test(entry)) acc.push(full);
  }
  return acc;
}

const citations = [];
const add = (raw, where) => {
  const path = normalize(raw);
  if (path) citations.push({ path, raw, where });
};

for (const file of walkFiles(root)) {
  const where = relative(root, file);
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/https?:\/\/[a-z.]*getpeppr\.[a-z]+(\/v1\/[A-Za-z0-9/_:{}.*-]*)/g)) {
    add(m[1], where);
  }
  for (const m of text.matchAll(/\b(?:GET|POST|PUT|PATCH|DELETE)\s+(\/v1\/[A-Za-z0-9/_:{}.*-]*)/g)) {
    add(m[1], where);
  }
}

// The Postman collection is JSON, so parse it rather than regex it — it is the
// artefact integrators import, and a wrong path there is a wrong path shipped.
const collection = JSON.parse(readFileSync(join(root, "postman/getpeppr.postman_collection.json"), "utf8"));
const walkItems = (items, trail) => {
  for (const item of items ?? []) {
    const path = [...trail, item.name ?? "(unnamed)"];
    if (Array.isArray(item.item)) walkItems(item.item, path);
    else if (item.request) {
      const raw = typeof item.request.url === "string" ? item.request.url : item.request.url?.raw;
      if (raw) add(raw, `postman: ${path.join(" / ")}`);
    }
  }
};
walkItems(collection.item, []);

assertFound(citations.length, 40, "API path citations");

// ---------------------------------------------------------------------- spec

let yaml;
try {
  const res = await fetch(SPEC_URL, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  yaml = await res.text();
} catch (err) {
  console.warn(`  SKIP  ${SPEC_URL} unreachable (${err.message}) — route check not run.`);
  console.warn("        The other checks still ran. Re-run this job once the site answers.");
  process.exit(0);
}

const templates = specPaths(yaml);
assertFound(templates.length, 20, "paths in the published OpenAPI spec");

const unknown = new Map();
for (const c of citations) {
  if (templates.some((t) => matches(c.path, t))) continue;
  if (!unknown.has(c.path)) unknown.set(c.path, new Set());
  unknown.get(c.path).add(c.where);
}

const distinct = new Set(citations.map((c) => c.path));
if (unknown.size > 0) {
  console.error(`  FAIL ${unknown.size} cited path(s) are in no published route:\n`);
  for (const [path, where] of unknown) {
    console.error(`         /v1${path}`);
    for (const w of where) console.error(`           cited in ${w}`);
  }
  console.error(`\nSpec: ${SPEC_URL} (${templates.length} paths).`);
  process.exit(1);
}
console.log(
  `  ok   ${citations.length} citations / ${distinct.size} distinct paths all exist ` +
    `among the ${templates.length} paths of ${SPEC_URL}`,
);
