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
function normalise(raw, literal = false) {
  let path = raw
    .replace(/^\{\{[^}]+\}\}/, "")
    .replace(/^https?:\/\/[^/]+/, "")
    .split(/[?#]/)[0]
    // Prose punctuation, not path: a sentence ending in a URL, a URL in
    // parentheses, a backticked path. `.` is kept mid-path — `xml.ubl.invoice.bis3`
    // is a real format segment.
    .replace(literal ? /$^/ : TRAILING_PUNCTUATION, "")
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

// Deliberately wide: a mention containing a character a real path may not have
// (`+`, `%`, `~`, `@`, a `${…}` interpolation) must be CAPTURED and then fail as
// unknown, never truncated at that character into a shorter path that happens
// to exist. `/v1/health+admin` truncated to `/health` is an approval of the
// wrong route.
const PATH_CHARS = "[A-Za-z0-9/_:{}.*$+%~@()!,;'-]*";
// Trailing prose punctuation, stripped AFTER capture rather than excluded from
// it: excluding a character would truncate `/v1/health+admin` into `/health`,
// which exists — an approval of the wrong route. `.` is kept mid-path because
// `xml.ubl.invoice.bis3` is a real format segment.
const TRAILING_PUNCTUATION = /[.,;:!?)\]`'"]+$/;
const METHODS = "GET|POST|PUT|PATCH|DELETE";
// Absolute URLs are only ours. A `/v1/…` under someone else's host documents
// their API, not this one.
// Label-anchored: `evilgetpeppr.dev` is not ours, and a substring match said it
// was.
const OUR_HOST = /^https?:\/\/([a-z0-9-]+\.)*getpeppr\.[a-z]+(?:[/:?#]|$)/i;

function mentionsIn(file, where) {
  const found = [];
  // Things wrong with the mention itself, rather than with the route it names.
  const misplaced = [];
  // `literal` says the mention came from inside a backtick code span, where a
  // trailing `!` or `.` is a character the author wrote, not sentence
  // punctuation. Stripping it there would silently turn `/v1/validate/server!`
  // — a route that does not exist — into one that does.
  const add = (raw, method, line, literal = false) => {
    if (/^https?:\/\//.test(raw) && !OUR_HOST.test(raw)) return;
    const path = normalise(raw, literal);
    if (path) found.push({ path, method, where: `${where}:${line}` });
  };
  const spanned = (line, index) => line[index - 1] === "`";
  const lines = readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");

  // A curl command may span continuation lines; its method is its `-X`,
  // `-XDELETE` or `--request`, defaulting to GET. Continuation lines are
  // recorded so the bare pass below does not count their URLs a second time
  // without the method.
  const curlMethod = new Map();
  const consumed = new Set();
  for (let i = 0; i < lines.length; i++) {
    // `curl` must start a command, not merely appear in a sentence.
    if (!/(?:^|[|&;$(]\s*)curl(?:\s|$)/.test(lines[i])) continue;
    let command = lines[i];
    let j = i;
    while (/\\\s*$/.test(lines[j]) && j + 1 < lines.length) {
      command += " " + lines[++j];
      consumed.add(j);
    }
    const method =
      new RegExp(`(?:--request|-X)[\\s=]*(${METHODS})`, "i").exec(command)?.[1]?.toUpperCase() ?? "GET";
    for (const m of command.matchAll(new RegExp(`(https?://[^\\s"']*)?(/v1/${PATH_CHARS})`, "g"))) {
      if (m[1] && !OUR_HOST.test(m[1])) {
        // A published curl example that calls someone else's host is a defect,
        // not noise to skip. In prose a foreign URL is legitimate; inside a
        // command a reader is meant to paste, it is not.
        misplaced.push({ what: `${m[1]}${m[2]} — a curl example must call the getpeppr API`, where: `${where}:${i + 1}` });
        continue;
      }
      curlMethod.set(`${i + 1}|${m[2]}`, method);
      add(m[2], method, i + 1, true);
    }
  }

  let inEndpointTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // The Method cell of an ENDPOINT table: | `GET` | `/v1/contacts/:id` | … |
    // Bounding the method name stops `BUDGET` from yielding GET, but leaving an
    // unrecognised token unchecked would let an invalid method ship instead. So
    // the cell is read — but only inside a table that declares itself an
    // endpoint table with a `| Method | Endpoint |` header. Any other
    // two-column table may legitimately hold a `/v1/…` in its second cell; this
    // README has one listing the check commands.
    const cells = /^\|([^|\n]*)\|([^|\n]*)\|/.exec(line);
    if (cells) {
      const first = cells[1].replace(/`/g, "").trim();
      if (/^method$/i.test(first)) inEndpointTable = true;
      else if (!/^:?-+:?$/.test(first)) {
        const cited = new RegExp(`\`?(/v1/${PATH_CHARS})`).exec(cells[2])?.[1];
        if (inEndpointTable && cited && first && !new RegExp(`^(?:${METHODS})$`).test(first)) {
          misplaced.push({ what: `${first} ${cited} — "${first}" is not an HTTP method`, where: `${where}:${i + 1}` });
        }
      }
    } else {
      inEndpointTable = false; // a non-table line ends the table
    }

    // Every method/path pair on a table row, not just the first: a row can
    // document more than one, and stopping at the first is how a mention goes
    // uncounted.
    for (const m of line.matchAll(
      new RegExp(`(?:^|[|\\s\`])(${METHODS})\\b\`?[^|\\n]*\\|[^|\\n]*?\`?(/v1/${PATH_CHARS})`, "g"),
    )) {
      const at = m.index + m[0].lastIndexOf(m[2]);
      add(m[2], m[1], i + 1, spanned(line, at));
    }

    // `METHOD /v1/…` or `METHOD` `/v1/…` in prose, backticks optional.
    for (const m of line.matchAll(new RegExp(`\\b(${METHODS})\`?[\\s]+\`?(/v1/${PATH_CHARS})`, "g"))) {
      const at = m.index + m[0].lastIndexOf(m[2]);
      add(m[2], m[1], i + 1, spanned(line, at));
    }

    // Any other `/v1/…`: an f-string in a Python example, a path in prose, a
    // string in TypeScript. Method unknown, so path existence only. A curl URL
    // already taken above, or a continuation line already folded into one, is
    // skipped so it is not counted twice.
    if (consumed.has(i)) continue;
    for (const m of line.matchAll(new RegExp(`(/v1/${PATH_CHARS})`, "g"))) {
      // A `/v1/…` under someone else's host, in PROSE, documents their API and
      // is not ours to check. The curl pass above judges the same thing
      // differently, on purpose.
      const host = /(https?:\/\/[^\s"'`]*)$/.exec(line.slice(0, m.index))?.[1];
      if (host && !OUR_HOST.test(host)) continue;
      if (curlMethod.has(`${i + 1}|${m[1]}`)) continue;
      add(m[1], null, i + 1, spanned(line, m.index));
    }
  }
  return { found, misplaced };
}

const mentions = [];
const misplaced = [];
for (const file of findFiles(root, /\.(md|ts|py)$/)) {
  const found = mentionsIn(file, rel(root, file));
  mentions.push(...found.found);
  misplaced.push(...found.misplaced);
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

// Two extractors can legitimately see the same thing on the same line. Counting
// it twice would inflate every number this check reports.
const seen = new Set();
const unique = mentions.filter((m) => {
  const key = `${m.method ?? "-"} ${m.path} ${m.where}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
mentions.length = 0;
mentions.push(...unique);

// One occurrence, one record. Several extractors legitimately see the same path
// on the same line — one knowing the method, the bare pass not — and keying on
// the method would keep both, so the count would describe records rather than
// occurrences and could not serve as an anti-vacuity floor.
//
// But a line can genuinely carry the same path under two methods:
// examples/curl/README.md documents `PUT /v1/transports/:code` and
// `DELETE /v1/transports/:code` on one line. Those are two operations. So the
// bare record is dropped only when a method was found for that same path and
// place; distinct methods all survive.
const byPlace = new Map();
for (const m of mentions) {
  const key = `${m.path} ${m.where}`;
  if (!byPlace.has(key)) byPlace.set(key, new Map());
  byPlace.get(key).set(m.method ?? null, m);
}
mentions.length = 0;
for (const group of byPlace.values()) {
  const methoded = [...group.values()].filter((m) => m.method);
  mentions.push(...(methoded.length > 0 ? methoded : [...group.values()]));
}

const distinctPaths = new Set(mentions.map((m) => m.path));
// 120 route mentions today, from 122 physical `/v1/` occurrences: 92 across the
// Markdown, Python and TypeScript files plus 30 Postman requests, less the two
// in this README's own prose that read `/v1/…` with an ellipsis and name no
// route. The floor leaves room for a legitimate edit and none for a surface
// going quiet.
assertFound(mentions.length, 110, "API path mentions");
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
if (misplaced.length > 0) {
  console.error(`  FAIL ${misplaced.length} mention(s) are malformed where they stand:\n`);
  for (const m of misplaced) console.error(`  - ${safe(m.what)}\n    · ${safe(m.where)}`);
}
if (unknownPath.size > 0) report("mentioned path(s) are in no published route", unknownPath);
if (unknownOperation.size > 0) report("mentioned operation(s) the spec does not declare", unknownOperation);
if (unknownPath.size > 0 || unknownOperation.size > 0 || misplaced.length > 0) {
  console.error(`\nSpec: ${SPEC_URL} (${operations.size} paths).`);
  process.exit(1);
}

console.log(
  `  ok   ${mentions.length} mentions / ${distinctPaths.size} distinct paths, ` +
    `${mentions.filter((m) => m.method).length} with a method, all found among the ` +
    `${operations.size} paths of ${SPEC_URL}`,
);
