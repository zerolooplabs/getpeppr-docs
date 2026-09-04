/**
 * Every `/v1/…` path this repository mentions must exist in the OpenAPI spec
 * getpeppr publishes, and where the mention also states an HTTP method, that
 * operation must exist too.
 *
 * This is the class GPR-1261 had to find by hand: `POST /v1/invoices/send` had
 * been removed from the API and stayed published across twelve sites. Both
 * halves of this check are needed to see it — the path `/invoices/send` is
 * three segments, so it matches the template `/invoices/{id}` on shape alone;
 * only the method tells the truth, because the spec declares `get`, `put` and
 * `delete` on that path and no `post`.
 *
 * Mentions are collected by SHAPE, from every file, in five forms: a Markdown
 * endpoint table row, a `METHOD /v1/…` in prose, the URL of a `curl` command
 * (whose method is its `-X`, defaulting to GET), the `url`/`method` pair of a
 * Postman request, and any other bare `/v1/…` occurrence — which is how the
 * Python examples, that build their URLs as `f"{BASE_URL}/v1/…"`, are seen at
 * all. A bare mention is checked for path existence only.
 *
 * The spec is downloaded from the public site — no key, no authenticated call.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFound, findFiles, safe, rel } from "./lib/markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_URL = process.env.SPEC_URL ?? "https://getpeppr.dev/openapi.yaml";
const POSTMAN = "postman/getpeppr.postman_collection.json";

// Operations this repository documents PRECISELY BECAUSE they do not exist:
// the README's Transports table lists them with "Always 405 Method Not
// Allowed". A whitelist, never a pattern — each entry is a deliberate,
// reviewable statement, and anything not on it is still checked.
const DOCUMENTED_405 = new Set([
  "POST /transports",
  "PUT /transports/{code}",
  "DELETE /transports/{code}",
]);

// ------------------------------------------------------------------- the spec

/** `{ "/invoices/{id}": Set{"GET","PUT","DELETE"}, … }` from the `paths:` block. */
function specOperations(yaml) {
  const lines = yaml.split("\n");
  const start = lines.findIndex((l) => /^paths:\s*$/.test(l));
  if (start === -1) throw new Error("no `paths:` block in the spec");
  const ops = new Map();
  let current = null;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\S/.test(line)) break; // back to a top-level key: the block ended
    const path = /^ {2}(\/\S*?):\s*$/.exec(line);
    if (path) {
      current = path[1];
      ops.set(current, new Set());
      continue;
    }
    const method = /^ {4}(get|post|put|patch|delete):\s*$/.exec(line);
    if (method && current) ops.get(current).add(method[1].toUpperCase());
  }
  return ops;
}

// ----------------------------------------------------------------- the mentions

/** `{{base_url}}/v1/contacts/:id?x=1` and `https://api…/v1/invoices/inv_a1.` alike. */
function normalise(raw) {
  let path = raw
    .replace(/^\{\{[^}]+\}\}/, "")
    .replace(/^https?:\/\/[^/]+/, "")
    .split(/[?#]/)[0]
    // Prose punctuation, not path: a sentence ending in a URL, a URL in
    // parentheses, a backticked path. `.` is kept mid-path — `xml.ubl.invoice.bis3`
    // is a real format segment.
    .replace(/[.,;:)\]`'"]+$/, "")
    .replace(/\/+$/, "");
  if (!path.startsWith("/v1/")) return null;
  path = path.slice(3); // spec paths are relative to the /v1 server URL

  // The colon form of a participant id: `/v1/directory/0208:BE0456789012`.
  // The spec declares one path key, `/directory/{scheme}/{participantId}`, but
  // its own description documents both forms, and a sandbox probe on
  // 2026-09-04 confirmed the colon form reaches the handler and resolves to the
  // same participant. Rewritten rather than reported, so this check stays about
  // routes that genuinely do not exist.
  return path.replace(/^\/directory\/([^/:]+):([^/]+)$/, "/directory/$1/$2");
}

const PATH_CHARS = "[A-Za-z0-9/_:{}.*-]*";
const METHODS = "GET|POST|PUT|PATCH|DELETE";

function mentionsIn(file, where) {
  const found = [];
  const add = (raw, method, line) => {
    const path = normalise(raw);
    if (path) found.push({ path, method, where: `${where}:${line}` });
  };
  const lines = readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // 1. A Markdown endpoint table row: | `GET` | `/v1/contacts/:id` | … |
    //    The method and the path are in different cells, so no whitespace
    //    separates them — the form that made the README's four endpoint tables
    //    invisible to the first version of this check.
    const row = new RegExp(`^\\|[^|\\n]*\`(${METHODS})\`[^|\\n]*\\|\\s*\`?(/v1/[^\`|\\s]*)`).exec(line);
    if (row) {
      add(row[2], row[1], i + 1);
      continue;
    }

    // 2. A curl command: its method is its -X, defaulting to GET. Continuation
    //    lines are joined so the -X of a multi-line command is not lost.
    if (/(^|\s)curl(\s|$)/.test(line)) {
      let command = line;
      let j = i;
      while (/\\\s*$/.test(lines[j]) && j + 1 < lines.length) command += " " + lines[++j];
      const method = new RegExp(`-X\\s+(${METHODS})`).exec(command)?.[1] ?? "GET";
      for (const m of command.matchAll(new RegExp(`(?:https?://[^\\s"']*)?(/v1/${PATH_CHARS})`, "g"))) {
        add(m[1], method, i + 1);
      }
      continue;
    }

    // 3. `METHOD /v1/…` in prose.
    for (const m of line.matchAll(new RegExp(`\\b(${METHODS})\\s+\`?(/v1/${PATH_CHARS})`, "g"))) {
      add(m[2], m[1], i + 1);
    }

    // 4. Any other `/v1/…`: an f-string in a Python example, a path in prose, a
    //    string in TypeScript. Method unknown, so path existence only.
    for (const m of line.matchAll(new RegExp(`(/v1/${PATH_CHARS})`, "g"))) {
      add(m[1], null, i + 1);
    }
  }
  return found;
}

const mentions = [];
for (const file of findFiles(root, /\.(md|ts|py)$/)) {
  mentions.push(...mentionsIn(file, rel(root, file)));
}

// The Postman collection is JSON, so parse it — it is the artefact integrators
// import, and it states its method explicitly.
const collection = JSON.parse(readFileSync(join(root, POSTMAN), "utf8"));
(function walk(items, trail) {
  for (const item of items ?? []) {
    const path = [...trail, item.name ?? "(unnamed)"];
    if (Array.isArray(item.item)) walk(item.item, path);
    else if (item.request) {
      const raw = typeof item.request.url === "string" ? item.request.url : item.request.url?.raw;
      const norm = raw && normalise(raw);
      if (norm) mentions.push({ path: norm, method: item.request.method ?? null, where: `${POSTMAN} — ${path.join(" / ")}` });
    }
  }
})(collection.item, []);

const distinctPaths = new Set(mentions.map((m) => m.path));
assertFound(mentions.length, 120, "API path mentions");
// Counting mentions alone would let half the distinct routes disappear while
// the total stayed high. Both are asserted.
assertFound(distinctPaths.size, 35, "distinct API paths mentioned");
assertFound(mentions.filter((m) => m.method).length, 80, "mentions that state their HTTP method");

// ------------------------------------------------------------------ the verdict

let yaml;
try {
  const res = await fetch(SPEC_URL, { signal: AbortSignal.timeout(20_000) });
  // A 4xx means the spec is not where we say it is — our URL, permanent, and
  // exactly the kind of defect this check exists to catch. A 5xx, a timeout or
  // a network error is the upstream's, transient, and someone else's monitor:
  // reddening on it would train everyone to ignore a red run.
  if (res.status >= 400 && res.status < 500) {
    console.error(`  FAIL ${SPEC_URL} answered HTTP ${res.status} — the published spec is not at that URL.`);
    process.exit(1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  yaml = await res.text();
} catch (err) {
  console.warn(`  SKIP  ${SPEC_URL} unreachable (${safe(err.message)}) — route check not run.`);
  console.warn("        The other checks still ran. Re-run this job once the site answers.");
  process.exit(0);
}

const operations = specOperations(yaml);
assertFound(operations.size, 20, "paths in the published OpenAPI spec");

const isParam = (segment) => /^[:{]/.test(segment);
/** A template's parameter matches any segment; a template's literal matches only itself. */
function matches(mentioned, template) {
  const a = mentioned.split("/");
  const b = template.split("/");
  return a.length === b.length && a.every((segment, i) => (isParam(b[i]) ? true : segment === b[i]));
}

const unknownPath = new Map();
const unknownOperation = new Map();
for (const m of mentions) {
  const templates = [...operations.keys()].filter((t) => matches(m.path, t));
  if (templates.length === 0) {
    if (!unknownPath.has(m.path)) unknownPath.set(m.path, new Set());
    unknownPath.get(m.path).add(m.where);
    continue;
  }
  if (!m.method) continue;
  if (templates.some((t) => operations.get(t).has(m.method))) continue;
  if (templates.some((t) => DOCUMENTED_405.has(`${m.method} ${t}`))) continue;
  const key = `${m.method} /v1${m.path}`;
  if (!unknownOperation.has(key)) unknownOperation.set(key, new Set());
  unknownOperation.get(key).add(m.where);
}

// Every untrusted value below is preceded by a non-whitespace character on its
// own line, so it can never be read as a GitHub Actions workflow command.
const report = (title, map) => {
  console.error(`  FAIL ${map.size} ${title}:\n`);
  for (const [what, where] of map) {
    console.error(`  - ${safe(what)}`);
    for (const w of where) console.error(`    · mentioned in ${safe(w)}`);
  }
};
if (unknownPath.size > 0) report("mentioned path(s) are in no published route", unknownPath);
if (unknownOperation.size > 0) report("mentioned operation(s) the spec does not declare", unknownOperation);
if (unknownPath.size > 0 || unknownOperation.size > 0) {
  console.error(`\nSpec: ${SPEC_URL} (${operations.size} paths).`);
  process.exit(1);
}

console.log(
  `  ok   ${mentions.length} mentions / ${distinctPaths.size} distinct paths, ` +
    `${mentions.filter((m) => m.method).length} with a method, all found among the ` +
    `${operations.size} paths of ${SPEC_URL}`,
);
