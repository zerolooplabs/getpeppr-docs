/**
 * Byte-compiles every published Python example.
 *
 * `py_compile` is a parse, not a run: it catches syntax errors and nothing
 * else. No dependency is installed, no request is made, no key is needed.
 *
 * What it does NOT catch — stated here so nobody reads a green run as more
 * than it is: a wrong dict key on an API response, a renamed field, a route
 * that no longer exists. `check:routes` covers the last of those; the first two
 * are only caught by reading the example against the SDK or the spec.
 */
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFound } from "./lib/markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "examples/python");
const files = readdirSync(dir).filter((f) => f.endsWith(".py")).sort();
assertFound(files.length, 10, "Python examples");

const python = process.env.PYTHON ?? "python3";
let failed = 0;
for (const f of files) {
  try {
    execFileSync(python, ["-m", "py_compile", join(dir, f)], { stdio: "pipe" });
    console.log(`  ok   examples/python/${f}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL examples/python/${f}`);
    console.error(`         ${String(err.stderr ?? err.message).trim()}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${files.length} Python examples do not compile.`);
  process.exit(1);
}
console.log(`\n${files.length} Python examples compile.`);
