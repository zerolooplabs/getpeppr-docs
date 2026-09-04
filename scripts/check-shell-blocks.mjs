/**
 * Parses every published shell block with `bash -n`.
 *
 * `-n` reads and parses without executing: an unbalanced quote, a missing
 * `done`, a stray backslash at the end of a curl continuation all fail here,
 * and nothing is ever run — no request leaves the machine, no key is needed.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fencedBlocks, assertFound } from "./lib/markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sources = ["README.md", "examples/curl/README.md"];

const blocks = sources.flatMap((file) =>
  fencedBlocks(join(root, file), "bash").map((b) => ({ ...b, file })),
);
assertFound(blocks.length, 25, "shell blocks in the READMEs");

const dir = mkdtempSync(join(tmpdir(), "getpeppr-docs-shell-"));
let failed = 0;
try {
  for (const b of blocks) {
    const path = join(dir, `block-${b.file.replace(/[^a-z0-9]+/gi, "-")}-L${b.line}.sh`);
    writeFileSync(path, b.code + "\n");
    try {
      execFileSync("bash", ["-n", path], { stdio: "pipe" });
      console.log(`  ok   ${b.file}:${b.line}`);
    } catch (err) {
      failed++;
      console.error(`  FAIL ${b.file}:${b.line}`);
      console.error(`         ${String(err.stderr ?? err.message).trim()}`);
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed > 0) {
  console.error(`\n${failed} of ${blocks.length} shell blocks do not parse.`);
  process.exit(1);
}
console.log(`\n${blocks.length} shell blocks parse.`);
