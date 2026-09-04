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
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { fencedBlocks, fenceLanguages, assertFound, findFiles, rel, safe } from "./lib/markdown.mjs";

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

// A block retagged from ```typescript to ```ts stops being compiled and takes
// the count one below the floor, which a minimum alone reads as a legitimate
// edit. Refusing the ALIAS catches the cause instead of counting the survivors.
// Only aliases that MEAN TypeScript. ```js and ```javascript are legitimate
// blocks that were never meant to be compiled as TypeScript; refusing them
// would be a false red on correct content.
const ALIASES = new Set(["ts", "tsx"]);
const fragments = [];
const retagged = [];
for (const file of findFiles(root, /\.md$/)) {
  const where = rel(root, file);
  for (const { lang, line } of fenceLanguages(file)) {
    if (ALIASES.has(lang)) retagged.push(`${where}:${line} is tagged \`\`\`${lang}`);
  }
  for (const block of fencedBlocks(file, "typescript")) {
    if (isProgram(block.code)) fragments.push({ ...block, file: where });
  }
}
if (retagged.length > 0) {
  console.error("  FAIL a TypeScript block is tagged with a language this check does not compile:");
  for (const r of retagged) console.error(`  - ${safe(r)} — use \`\`\`typescript`);
  process.exit(1);
}

// A ```js or ```javascript block is legitimate and is NOT compiled as
// TypeScript — but it must still be valid JavaScript, or retagging a TypeScript
// block to `javascript` would be a way to stop it being checked at all. Parsed
// only, never run.
const jsProblems = [];
for (const file of findFiles(root, /\.md$/)) {
  const at = rel(root, file);
  for (const lang of ["js", "javascript"]) {
    for (const block of fencedBlocks(file, lang)) {
      if (!isProgram(block.code)) continue;
      const source = ts.createSourceFile(`snippet.js`, block.code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
      for (const d of source.parseDiagnostics ?? []) {
        jsProblems.push(`${at}:${block.line} — ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`);
      }
    }
  }
}
if (jsProblems.length > 0) {
  console.error("  FAIL a JavaScript block does not parse as JavaScript:");
  for (const j of jsProblems) console.error(`  - ${safe(j)}`);
  process.exit(1);
}
assertFound(fragments.length, 5, "TypeScript fragments in the Markdown files");

// Compiled under node_modules/.cache: close enough to the repository that
// `@getpeppr/sdk`, `@types/node` and the root package.json's `"type": "module"`
// resolve exactly as they do for the example files — no `paths` mapping that
// could drift from reality — while being somewhere no interruption can leave a
// stray .ts file that the other checks would then read as published content.
mkdirSync(join(root, "node_modules/.cache"), { recursive: true });
const dir = mkdtempSync(join(root, "node_modules/.cache/getpeppr-docs-snippets-"));
let failures = [];
try {
  const preamble = join(dir, "zz-preamble.d.ts");
  writeFileSync(preamble, PREAMBLE);
  const canary = join(dir, "zz-canary.ts");
  // The canary must exercise what the FRAGMENTS depend on — the preamble's
  // ambient declarations — not the SDK directly. A canary that imports
  // @getpeppr/sdk itself keeps working while the preamble's own import is
  // broken, which is precisely the case that turns every ambient type into
  // `any` and every fragment above into a vacuous pass.
  writeFileSync(canary, "const _canary: number = peppol;\n");
  const files = [];
  for (const [i, f] of fragments.entries()) {
    // Indexed: `a/b.md` and `a-b.md` both slugify to `a-b-md`, and the second
    // write would silently replace the first — a fragment reported green
    // without ever being compiled.
    const name = `${String(i).padStart(3, "0")}-${f.file.replace(/[^a-z0-9]+/gi, "-")}-L${f.line}.ts`;
    const path = join(dir, name);
    writeFileSync(path, f.code + "\n");
    files.push({ label: safe(`${f.file}:${f.line}`), path });
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
  const program = ts.createProgram([preamble, canary, ...files.map((f) => f.path)], options);

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
      for (const e of errors) console.error(`  - ${safe(e)}`);
    }
  }
  // `skipLibCheck` makes a broken import inside a .d.ts produce NO diagnostic
  // at all, so reading the preamble's own errors detects nothing. The canary is
  // a statement that MUST fail to compile; if it passes, the ambient types have
  // degraded to `any` and every fragment above was checked against nothing.
  if (errorsFor(canary).length === 0) {
    failures.push("preamble");
    console.error("  FAIL preamble — the canary compiled, so the SDK types resolved to `any`:");
    console.error("  - every fragment above was type-checked against nothing. Check the @getpeppr/sdk import.");
  }
  for (const e of byFile.get("(global)") ?? []) {
    failures.push("preamble");
    console.error(`  FAIL preamble — ${safe(e)}`);
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
