import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { join, relative } from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".git", "__pycache__"]);

/**
 * Every file under `dir` whose name matches `pattern`, recursively.
 *
 * Discovery is by WALK, never by a hardcoded list: a README added in a new
 * subdirectory is checked the day it lands, not the day someone remembers to
 * add it here.
 *
 * Symbolic links are skipped, not followed. A repository can contain one that
 * points outside the tree, or at an ancestor — the second turns this walk into
 * unbounded recursion, and a public repository accepts pull requests from
 * anyone.
 */
export function findFiles(dir, pattern, acc = []) {
  for (const entry of readdirSync(dir).sort()) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) findFiles(full, pattern, acc);
    else if (pattern.test(entry)) acc.push(full);
  }
  return acc;
}

/**
 * Every backtick-fenced block of a given language in a Markdown file.
 *
 * Accepts what these files actually use, plus the neighbouring CommonMark forms
 * a future edit might introduce: up to three spaces of indentation, four or more
 * backticks, an info string after the language (```bash title="x"), and any
 * capitalisation. Tilde fences (~~~) are NOT supported — no file here uses one,
 * and `fenceLanguages` below is what stops one from arriving unnoticed.
 *
 * The closing fence must be at least as long as the opening one and carry no
 * info string, which is what lets a ````-fenced block contain a ``` block
 * without being truncated by it.
 */
const OPEN = /^ {0,3}(`{3,})[ \t]*([A-Za-z0-9_+-]*)/;
const CLOSE = /^ {0,3}(`{3,})[ \t]*$/;

export function fencedBlocks(file, lang) {
  const lines = readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (open === null) {
      const m = OPEN.exec(line);
      if (m && m[2].toLowerCase() === lang.toLowerCase()) {
        open = { line: i + 2, fence: m[1], body: [] };
      } else if (m) {
        // An opening fence of another language still opens a block; skipping to
        // its close is what stops a ```text block that quotes ```typescript from
        // being read as code.
        for (let j = i + 1; j < lines.length; j++) {
          const c = CLOSE.exec(lines[j]);
          if (c && c[1].length >= m[1].length) { i = j; break; }
        }
      }
      continue;
    }
    const close = CLOSE.exec(line);
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

/**
 * Every fence language used in a file, with its line.
 *
 * A minimum count catches a surface that collapses; it cannot catch a single
 * block retagged from ```typescript to ```ts, which leaves the count one below
 * the floor and the run green. Callers use this to refuse the ALIAS, which is
 * the cause, rather than to count what survived it.
 */
export function fenceLanguages(file) {
  const lines = readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");
  const found = [];
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    if (open === null) {
      const m = OPEN.exec(lines[i]);
      if (m) {
        open = m[1];
        if (m[2]) found.push({ lang: m[2].toLowerCase(), line: i + 1 });
      }
      continue;
    }
    const c = CLOSE.exec(lines[i]);
    if (c && c[1].length >= open.length) open = null;
  }
  return found;
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
 * A pull request can put anything in a Postman request name, a Markdown line or
 * a FILE NAME — git stores newlines in paths — and GitHub Actions reads a line
 * beginning (after optional whitespace) with `::` as a workflow command:
 * `::error::`, `::add-mask::`. Collapsing newlines means such a value can never
 * begin a line; every call site also prints a non-whitespace character before
 * it, so it can never be the first thing on one either.
 */
export const safe = (value) => String(value).replace(/[\r\n\t]+/g, " ").slice(0, 300);

/** Repository-relative path, made safe to print. */
export const rel = (root, file) => safe(relative(root, file) || file);
