/**
 * Byte-compiles every published Python example.
 *
 * `py_compile` is a parse, not a run: it catches syntax errors and nothing
 * else. No dependency is installed, no request is made, no key is needed.
 *
 * What it does NOT catch — stated here so nobody reads a green run as more than
 * it is: a wrong dict key on an API response, a renamed field, a value written
 * to a file with the wrong extension, an exception raised outside the `try` that
 * was meant to catch it. GPR-1261 found three `KeyError`s of exactly this kind
 * by hand. `check:routes` covers the URLs; the field-level half is uncovered.
 */
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFound, findFiles, safe, rel } from "./lib/markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = findFiles(join(root, "examples"), /\.py$/);
assertFound(files.length, 10, "Python examples");

const python = process.env.PYTHON ?? "python3";
let failed = 0;
for (const f of files) {
  try {
    execFileSync(python, ["-m", "py_compile", f], { stdio: "pipe" });
    console.log(`  ok   ${rel(root, f)}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL ${rel(root, f)}`);
    console.error(`  - ${safe(String(err.stderr ?? err.message).trim())}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${files.length} Python examples do not compile.`);
  process.exit(1);
}
console.log(`\n${files.length} Python examples compile.`);
