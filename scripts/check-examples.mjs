/**
 * Type-checks examples/typescript/ against the @getpeppr/sdk published on npm,
 * with `strict` on, exactly as an integrator's project would.
 *
 * The `tsc` invocation is wrapped rather than called directly so that this
 * sweep, like every other, asserts a minimum count first: `tsc --noEmit` over
 * an emptied directory is green, and a green run over nothing is the failure
 * mode this whole toolchain exists to prevent.
 */
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFound, findFiles, rel, safe } from "./lib/markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = findFiles(join(root, "examples/typescript"), /\.ts$/);
assertFound(files.length, 12, "TypeScript example files");

try {
  // Piped, not inherited: `tsc` prints the file names it read, and a repository
  // can contain a name with a newline in it — which, printed raw, would let a
  // pull request forge a GitHub Actions workflow command.
  execFileSync("npx", ["tsc", "--noEmit"], { cwd: root, stdio: "pipe" });
} catch (err) {
  for (const line of String(err.stdout ?? "").split("\n").filter(Boolean)) {
    console.error(`  - ${safe(line)}`);
  }
  console.error(`\n${files.length} TypeScript examples were type-checked; at least one does not compile.`);
  process.exit(1);
}
for (const f of files) console.log(`  ok   ${rel(root, f)}`);
console.log(`\n${files.length} TypeScript examples compile against @getpeppr/sdk.`);
