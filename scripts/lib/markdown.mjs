import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** Directories no check ever walks into. `.snippets-check-*` is a scratch
 *  directory one of the checks writes; walking it would report a defect at a
 *  path that no longer exists by the time anyone opens it. */
const SKIP_DIRS = new Set(["node_modules", ".git", "__pycache__"]);
const isSkipped = (name) => SKIP_DIRS.has(name) || name.startsWith(".snippets-check-");

/**
 * Every file under `dir` whose name matches `pattern`, recursively.
 *
 * Discovery is by WALK, never by a hardcoded list: a README added in a new
 * subdirectory is checked the day it lands, not the day someone remembers to
 * add it here.
 */
export function findFiles(dir, pattern, acc = []) {
  for (const entry of readdirSync(dir).sort()) {
    if (isSkipped(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) findFiles(full, pattern, acc);
    else if (pattern.test(entry)) acc.push(full);
  }
  return acc;
}

/**
 * Every fenced block of a given language in a Markdown file.
 *
 * CommonMark allows up to three spaces of indentation before a fence, four or
 * more backticks, and an info string after the language (```bash title="x").
 * All three are accepted here — not for completeness, but because the failure
 * mode of a stricter parser is SILENT OMISSION: an unrecognised opening fence
 * makes the block vanish with no error, and the only thing standing between
 * that and a green run is the anti-vacuity minimum.
 *
 * The closing fence must be at least as long as the opening one and carry no
 * info string, per CommonMark — which is what lets a ````-fenced block contain
 * a ``` block without being truncated by it.
 */
export function fencedBlocks(file, lang) {
  const lines = readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (open === null) {
      const m = /^ {0,3}(`{3,})\s*([A-Za-z0-9_+-]*)/.exec(line);
      if (m && m[2].toLowerCase() === lang.toLowerCase()) {
        open = { line: i + 2, fence: m[1], body: [] };
      }
      continue;
    }
    const close = /^ {0,3}(`{3,})\s*$/.exec(line);
    if (close && close[1].length >= open.fence.length) {
      blocks.push({ file, line: open.line, code: open.body.join("\n") });
      open = null;
      continue;
    }
    open.body.push(line);
  }
  if (open !== null) {
    throw new Error(`${file}: unterminated \`\`\`${lang} block opened at line ${open.line - 1}`);
  }
  return blocks;
}

/** Fail loudly when a check found nothing to check. An empty sweep is not a pass. */
export function assertFound(count, minimum, what) {
  if (count < minimum) {
    throw new Error(
      `anti-vacuity: found ${count} ${what}, expected at least ${minimum}. ` +
        `Either the content moved and this check is now blind, or the minimum needs lowering on purpose.`,
    );
  }
}

/**
 * Makes a value read from repository content safe to print in CI.
 *
 * A fork's pull request can put anything in a Postman request name or a file
 * path, and GitHub Actions reads a line beginning (after optional whitespace)
 * with `::` as a workflow command — `::error::`, `::add-mask::`. Collapsing
 * newlines means a value can never begin a line; every call site below also
 * prints a non-whitespace character before it, so it can never be the first
 * thing on one either.
 */
export const safe = (value) =>
  String(value).replace(/[\r\n\t]+/g, " ").slice(0, 300);

/** Repository-relative path, for messages a human has to act on. */
export const rel = (root, file) => relative(root, file) || file;
