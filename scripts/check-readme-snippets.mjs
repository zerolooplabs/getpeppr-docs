/**
 * Compiles the TypeScript fragments published in the Markdown files.
 *
 * The files under examples/typescript/ are whole programs and `check:examples`
 * covers them. These blocks are fragments: they lean on identifiers the
 * surrounding prose introduced (`peppol`, `rawBody`, `req`…). Those are declared
 * once in the preamble below, typed with the SDK's own types and never looser
 * than the SDK — a preamble that types something `any` would let the very
 * mistake this check exists to catch pass. Diagnostics on the preamble itself
 * fail the run, so it cannot decay into permissiveness unnoticed.
 *
 * Each fragment becomes its own module, so a `const invoice = …` inside a
 * fragment legally shadows the ambient `invoice`.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { fencedBlocks, assertFound, findFiles, rel } from "./lib/markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PREAMBLE = `
import type { Peppol, InvoiceInput, SendResult } from "@getpeppr/sdk";
declare global {
  const peppol: Peppol;
  /** The invoice payload the prose built a few lines earlier. */
  const data: InvoiceInput;
  const invoices: InvoiceInput[];
  /** The result of the send the prose performed a few lines earlier. */
  const invoice: SendResult;
  const rawBody: string;
  /**
   * A header is \`string | string[] | undefined\` in every Node HTTP framework.
   * Typing it \`string\` here would let a snippet hand a \`string[]\` straight to
   * \`constructEvent(signature: string)\` — one of the mistakes this check exists
   * to catch.
   */
  const req: { headers: Record<string, string | string[] | undefined>; body: string };
}
export {};
`;

// A shell line tagged as typescript is not a program. Anchored to the FIRST
// line only: a legitimate fragment whose template literal happens to contain a
// line starting with `curl ` must still be compiled, and a filter that silently
// drops it would be this tool's own failure mode.
const isProgram = (code) => !/^(?:npm|npx|getpeppr|curl|pip)\s/.test(code.trim());

const fragments = [];
for (const file of findFiles(root, /\.md$/)) {
  for (const block of fencedBlocks(file, "typescript")) {
    if (isProgram(block.code)) fragments.push({ ...block, file: rel(root, file) });
  }
}
assertFound(fragments.length, 5, "TypeScript fragments in the Markdown files");

// Compiled inside the repository so `@getpeppr/sdk`, `@types/node` and the root
// package.json's `"type": "module"` all resolve exactly as they do for the
// example files — no `paths` mapping that could drift from reality.
const dir = mkdtempSync(join(root, ".snippets-check-"));
let failures = [];
try {
  const preamble = join(dir, "zz-preamble.d.ts");
  writeFileSync(preamble, PREAMBLE);
  const files = [];
  for (const f of fragments) {
    const name = `${f.file.replace(/[^a-z0-9]+/gi, "-")}-L${f.line}.ts`;
    const path = join(dir, name);
    writeFileSync(path, f.code + "\n");
    files.push({ label: `${f.file}:${f.line}`, path });
  }

  const options = {
    strict: true,
    target: ts.ScriptTarget.ES2022,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    esModuleInterop: true,
    noEmit: true,
    skipLibCheck: true,
    types: ["node"],
  };
  const program = ts.createProgram([preamble, ...files.map((f) => f.path)], options);

  const byFile = new Map();
  for (const d of ts.getPreEmitDiagnostics(program)) {
    const key = d.file?.fileName ?? "(global)";
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key).push(`TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`);
  }
  const errorsFor = (path) => byFile.get(path.replace(/\\/g, "/")) ?? byFile.get(path) ?? [];

  for (const { label, path } of files) {
    const errors = errorsFor(path);
    if (errors.length === 0) {
      console.log(`  ok   ${label}`);
    } else {
      failures.push(label);
      console.error(`  FAIL ${label}`);
      for (const e of errors) console.error(`  - ${e}`);
    }
  }
  // `skipLibCheck` plus per-fragment reporting would otherwise let a broken
  // import in the preamble degrade every ambient type to `any` in silence.
  for (const e of [...errorsFor(preamble), ...(byFile.get("(global)") ?? [])]) {
    failures.push("preamble");
    console.error(`  FAIL preamble — ${e}`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// Outside the try/finally: `process.exit` does not unwind the stack, so an exit
// inside it would skip the cleanup above and leave a directory of stray .ts
// files in the repository — which `check:routes` would then read as published
// content.
if (failures.length > 0) {
  console.error(`\n${failures.length} of ${fragments.length} Markdown fragments do not compile against @getpeppr/sdk.`);
  process.exit(1);
}
console.log(`\n${fragments.length} Markdown fragments compile against @getpeppr/sdk.`);
