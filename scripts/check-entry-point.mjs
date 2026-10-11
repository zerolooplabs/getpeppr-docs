/**
 * This repository is the only public GitHub entry point to getpeppr (GPR-1415).
 * A developer who lands here — or an assistant that points them here — must be
 * able to get a sandbox key and send a first invoice that the sandbox accepts.
 * Three things broke that path without any other check noticing:
 *
 * 1. A dead end. The Next.js starter repository is archived and the old docs
 *    subdomain no longer serves the documentation. A link to either sends the
 *    reader somewhere that cannot help them (on 2026-10-11 the subdomain did
 *    not even resolve). Neither is linked today; this keeps it that way.
 *
 * 2. A recipient that cannot receive. The examples used to address a Belgian
 *    VAT number that is not on the Peppol network (the Directory answers 404,
 *    and its check digits do not even match). The sandbox delivers only to
 *    test recipients, so every send example failed for anyone who ran it.
 *
 * 3. A VAT line the sandbox refuses. A send is accepted only if its tax profile
 *    matches the SENDER's: a tax-bearing line from a sender without a tax
 *    identifier (`sender_tax_identifier_missing`), or an outside-scope line from
 *    a sender with one, is a synchronous 422 (GPR-1149 — no static invoice
 *    satisfies both; measured again on 2026-10-11 with the 21 % sample). A fixed
 *    sample addressed to the test receiver therefore carries the audited
 *    outside-scope line (`vatRate: 0`, `vatCategory: "O"`), unless it takes the
 *    line from `GET /identity` (`...identity.sandboxFirstSend.line`).
 *
 * Like `check-peppol-ids.mjs`, nothing in the repository is exempt — this file
 * included — which is why the forbidden values below are assembled from parts
 * instead of quoted: a literal here would trip the sweep it defines.
 *
 * What this check cannot see: a sample that reaches the test receiver through a
 * variable (`peppolId: buyer.peppolId`) carries no literal to anchor on. The
 * per-surface minimums keep the sweep from going blind, not from missing those.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFound, findFiles, rel, safe } from "./lib/markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN = [
  { value: ["peppol-invoice-", "nextjs-starter"].join(""), why: "archived starter repository" },
  { value: ["docs", "getpeppr", "dev"].join("."), why: "retired docs subdomain; the docs live at getpeppr.dev/docs" },
  { value: ["BE09876", "54321"].join(""), why: "not on the Peppol network; use the test receiver 9925:BE0314595348" },
];

const SIGN_UP = "https://console.getpeppr.dev/sign-up?source=github-docs";
const TEST_RECEIVER = /\\?["']?peppolId\\?["']?\s*:\s*\\?["']9925:BE0314595348\\?["']/;
const VAT_RATE = /\\?["']?vatRate\\?["']?\s*:\s*(\d+(?:\.\d+)?)/g;
const VAT_CATEGORY_O = /\\?["']?vatCategory\\?["']?\s*:\s*\\?["']O\\?["']/g;
const IDENTITY_LINE = /\.\.\.identity\.sandboxFirstSend\.line\b/;

const files = findFiles(root, /\.(md|ts|py|json|mjs|ya?ml|sh|txt)$/);
assertFound(files.length, 30, "text files to sweep");

const failures = [];

// 1 + 2 — dead ends and an unreachable recipient, anywhere in the tree.
for (const file of files) {
  const lines = readFileSync(file, "utf-8").split("\n");
  lines.forEach((line, i) => {
    for (const { value, why } of FORBIDDEN) {
      if (line.includes(value)) failures.push(`${rel(root, file)}:${i + 1}: ${safe(why)}`);
    }
  });
}

// The way in: a sign-up link, attributed to this repository, before any code.
const readme = readFileSync(join(root, "README.md"), "utf-8");
const cta = readme.indexOf(SIGN_UP);
const firstFence = readme.indexOf("```");
if (cta === -1) failures.push(`README.md: no sandbox sign-up link (${SIGN_UP})`);
else if (firstFence !== -1 && cta > firstFence) failures.push("README.md: the sandbox sign-up link comes after the first code sample");

// 3 — every fixed sample addressed to the test receiver carries a VAT line it accepts.
/**
 * A sample runs from the receiver line to the end of its code fence, or 25
 * lines at most. A Postman body is a single `raw` string, so there the sample
 * is that line alone — 25 lines would reach into the next request's body.
 */
function sampleFrom(lines, i) {
  if (lines[i].includes('"raw":')) return lines[i];
  const out = [];
  for (let j = i; j < Math.min(lines.length, i + 25); j++) {
    if (j > i && lines[j].trimStart().startsWith("```")) break;
    out.push(lines[j]);
  }
  return out.join("\n");
}

const SURFACES = [
  // TypeScript and cURL. The CLI line passes the receiver as `--to`, not as a
  // peppolId field, and carries no VAT line to check.
  { label: "README.md", minimum: 2, match: (p) => p === "README.md" },
  { label: "examples", minimum: 10, match: (p) => p.startsWith("examples/") },
  { label: "Postman collection", minimum: 4, match: (p) => p.startsWith("postman/") },
];
const receiverLines = [];
let samplesWithLines = 0;

for (const file of files) {
  const where = rel(root, file);
  const lines = readFileSync(file, "utf-8").split("\n");
  lines.forEach((line, i) => {
    if (!TEST_RECEIVER.test(line)) return;
    receiverLines.push(where);
    const sample = sampleFrom(lines, i);
    const rates = [...sample.matchAll(VAT_RATE)].map((m) => Number(m[1]));
    if (rates.length === 0 || IDENTITY_LINE.test(sample)) return;
    samplesWithLines++;
    const outsideScope = (sample.match(VAT_CATEGORY_O) ?? []).length;
    const reasons = [];
    if (rates.some((r) => r !== 0)) reasons.push(`vatRate ${rates.filter((r) => r !== 0).join(", ")}`);
    if (outsideScope < rates.length) reasons.push(`${rates.length - outsideScope} VAT line(s) without vatCategory "O"`);
    if (reasons.length > 0) {
      failures.push(
        `${where}:${i + 1}: sample to the test receiver — ${reasons.join("; ")}. ` +
          `Use vatRate 0 + vatCategory "O", or spread identity.sandboxFirstSend.line.`,
      );
    }
  });
}

// Anti-vacuity, reported with the other problems rather than thrown ahead of
// them: a run that stops at "too few samples" hides the dead links it found.
const floors = [
  ...SURFACES.map((s) => ({
    count: receiverLines.filter((p) => s.match(p)).length, minimum: s.minimum, what: `test-receiver samples in ${s.label}`,
  })),
  { count: samplesWithLines, minimum: 10, what: "fixed test-receiver samples carrying a VAT line" },
];
for (const { count, minimum, what } of floors) {
  if (count < minimum) failures.push(`anti-vacuity: found ${count} ${what}, expected at least ${minimum}`);
}

if (failures.length > 0) {
  for (const f of failures) console.error(`  - ${f}`);
  console.error(`\n${failures.length} problem(s) on the GitHub entry point.`);
  process.exit(1);
}

console.log(
  `  ok   ${files.length} files: no dead link, no unreachable recipient; sign-up link before the first sample; ` +
    `${samplesWithLines} fixed test-receiver samples carry the outside-scope line.`,
);
