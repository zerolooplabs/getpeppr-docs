/**
 * Parses every published shell block with `bash -n`.
 *
 * `-n` reads and parses without executing: an unbalanced quote, an unterminated
 * heredoc, a missing `done` or `fi` all fail here, and nothing is ever run — no
 * request leaves the machine, no key is needed.
 *
 * What it does NOT catch, so nobody reads a green run as more than it is: a
 * command that parses but is wrong. A misspelled header, a flag that does not
 * exist, a JSON body that is not valid JSON, a trailing `\` on the last line —
 * all parse cleanly. `check:routes` covers the URLs; the rest is uncovered.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fencedBlocks, assertFound, findFiles, safe, rel } from "./lib/markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Discovered by walk: a README added in a new subdirectory is checked the day
// it lands, not the day someone remembers to name it here.
const blocks = findFiles(root, /\.md$/).flatMap((file) =>
  fencedBlocks(file, "bash").map((b) => ({ ...b, file: rel(root, file) })),
);
assertFound(blocks.length, 28, "shell blocks in the Markdown files");

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
      console.error(`  - ${safe(String(err.stderr ?? err.message).trim())}`);
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// Outside the try/finally: `process.exit` does not unwind the stack, so an exit
// inside it would skip the cleanup above.
if (failed > 0) {
  console.error(`\n${failed} of ${blocks.length} shell blocks do not parse.`);
  process.exit(1);
}
console.log(`\n${blocks.length} shell blocks parse.`);
