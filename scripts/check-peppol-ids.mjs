/**
 * Every Peppol identifier this repository publishes must pass the validator
 * that ships in @getpeppr/sdk — the same call an integrator's first line of
 * code makes.
 *
 * Why this check exists (GPR-1347). Thirty published locations taught
 * `0208:BE0123456789` as a Belgian Peppol ID. Scheme 0208 is the Belgian
 * enterprise number: ten bare digits, never prefixed `BE`. That prefix belongs
 * to 9925, the VAT scheme. Our own SDK answered
 * `{"valid":false,"error":"Format mismatch: expected 10 digits."}` — so an
 * example copied verbatim was rejected before it ever reached the network.
 *
 * Nothing in the toolchain could see it. `tsc` type-checks a string literal
 * without reading it, `py_compile` does not resolve a dictionary key, and the
 * CI deliberately never calls the gateway. A literal is only wrong against a
 * domain rule, so the domain rule has to run here.
 *
 * The sweep covers all four client forms — TypeScript, Python, shell/Markdown
 * and the Postman collection — because the defect spanned all four, and a lock
 * written for one of them is the reason the other three drift unnoticed.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePeppolIdentifier } from "@getpeppr/sdk";
import { assertFound, findFiles, rel, safe } from "./lib/markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * `scheme:id` in prose and code. The scheme is a four-digit Peppol EAS code;
 * the identifier is required to carry a digit after an optional two-letter
 * country prefix, which is what keeps `INV-2026-001` and a clock reading out
 * of the sweep without maintaining a list of things to ignore.
 */
const COLON_FORM = /\b(\d{4}):([A-Za-z]{0,2}\d[A-Za-z0-9._-]{3,})\b/g;

/** The same pair as a URL path: /v1/directory/0208/BE0123456789 */
const PATH_FORM = /\/v1\/directory\/(\d{4})\/([A-Za-z]{0,2}\d[A-Za-z0-9._-]{3,})\b/g;

const files = [
  join(root, "README.md"),
  ...findFiles(join(root, "examples"), /\.(ts|py|md)$/),
  ...findFiles(join(root, "postman"), /\.json$/),
];

/** @type {{scheme: string, id: string, where: string}[]} */
const found = [];

const record = (scheme, id, where) => found.push({ scheme, id, where });

for (const file of files) {
  const where = rel(root, file);
  const lines = readFileSync(file, "utf-8").split("\n");
  lines.forEach((line, i) => {
    for (const re of [COLON_FORM, PATH_FORM]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) record(m[1], m[2], `${where}:${i + 1}`);
    }
  });
}

/**
 * Postman keeps a path variable as its own field, so the scheme and the
 * identifier never sit next to each other in the text. The `0208` that
 * survived the first sweep of GPR-1347 survived it exactly here.
 */
for (const file of findFiles(join(root, "postman"), /\.json$/)) {
  const where = rel(root, file);
  const collection = JSON.parse(readFileSync(file, "utf-8"));
  const walk = (items) => {
    for (const item of items ?? []) {
      if (item.item) {
        walk(item.item);
        continue;
      }
      const variables = item.request?.url?.variable ?? [];
      const scheme = variables.find((v) => v.key === "scheme")?.value;
      const id = variables.find((v) => v.key === "id")?.value;
      if (scheme && id && /^\d{4}$/.test(scheme)) {
        record(scheme, id, `${where} → ${safe(item.name)} (path variables)`);
      }
    }
  };
  walk(collection.item);
}

assertFound(found.length, 25, "published Peppol identifiers");

const failures = [];
const seen = new Set();
for (const { scheme, id, where } of found) {
  const verdict = validatePeppolIdentifier(scheme, id);
  if (!verdict.valid) failures.push({ scheme, id, where, error: verdict.error });
  seen.add(`${scheme}:${id}`);
}

if (failures.length > 0) {
  for (const f of failures) {
    console.error(`  - ${f.where}: ${safe(`${f.scheme}:${f.id}`)} — ${safe(f.error)}`);
  }
  console.error(
    `\n${failures.length} of ${found.length} published Peppol identifiers are rejected by ` +
      `@getpeppr/sdk. An example a developer copies must validate.`,
  );
  process.exit(1);
}

console.log(
  `\n${found.length} published Peppol identifiers (${seen.size} distinct) validate against @getpeppr/sdk.`,
);
