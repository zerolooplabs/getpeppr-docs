/**
 * Compiles the TypeScript fragments published in README.md.
 *
 * The files under examples/typescript/ are whole programs and `tsc --noEmit`
 * covers them. The README blocks are fragments: they lean on identifiers the
 * surrounding prose introduced (`peppol`, `rawBody`, `req`…). Those are declared
 * once in the preamble below, typed with the SDK's own types and never looser
 * than the SDK — a preamble that types something `any` would let the very
 * mistake this check exists to catch pass.
 *
 * Each fragment becomes its own module, so a `const invoice = …` inside a
 * fragment legally shadows the ambient `invoice`.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { fencedBlocks, assertFound } from "./lib/markdown.mjs";

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

// A shell line (`npm install …`) tagged as typescript is not a program. Skipped
// by SHAPE, never by name, so a newly added fragment is compiled by default.
const isProgram = (code) => !/^(?:npm|npx|getpeppr|curl|pip)\s/m.test(code.trim());

const sources = ["README.md"];
const fragments = [];
for (const file of sources) {
  for (const block of fencedBlocks(join(root, file), "typescript")) {
    if (isProgram(block.code)) fragments.push({ ...block, file });
  }
}
assertFound(fragments.length, 5, "TypeScript fragments in the READMEs");

// Compiled inside the repository so `@getpeppr/sdk`, `@types/node` and the
// root package.json's `"type": "module"` all resolve exactly as they do for the
// example files — no `paths` mapping that could drift from reality.
const dir = mkdtempSync(join(root, ".snippets-check-"));
try {
  const files = [];
  writeFileSync(join(dir, "zz-preamble.d.ts"), PREAMBLE);
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
  const program = ts.createProgram([join(dir, "zz-preamble.d.ts"), ...files.map((f) => f.path)], options);

  const byFile = new Map();
  for (const d of ts.getPreEmitDiagnostics(program)) {
    const key = d.file?.fileName ?? "(global)";
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key).push(`TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`);
  }

  let failed = 0;
  for (const { label, path } of files) {
    const errors = byFile.get(path.replace(/\\/g, "/")) ?? byFile.get(path) ?? [];
    if (errors.length === 0) {
      console.log(`  ok   ${label}`);
    } else {
      failed++;
      console.error(`  FAIL ${label}`);
      for (const e of errors) console.error(`         ${e}`);
    }
  }
  const global = byFile.get("(global)") ?? [];
  for (const e of global) console.error(`  FAIL (global)  ${e}`);

  if (failed > 0 || global.length > 0) {
    console.error(`\n${failed} of ${files.length} README fragments do not compile against @getpeppr/sdk.`);
    process.exit(1);
  }
  console.log(`\n${files.length} README fragments compile against @getpeppr/sdk.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
