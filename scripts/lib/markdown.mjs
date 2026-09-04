import { readFileSync } from "node:fs";

/**
 * Every fenced block of a given language in a Markdown file.
 *
 * The fence is matched at column 0 only. A ``` that appears indented inside a
 * block (a nested example) therefore does not close it, which is what keeps a
 * README with nested fences from silently truncating a snippet — a truncated
 * snippet still parses, so nothing downstream would notice.
 *
 * @param {string} file  path to the Markdown file
 * @param {string} lang  the language tag after the opening fence, e.g. "bash"
 * @returns {{file: string, line: number, code: string}[]}
 */
export function fencedBlocks(file, lang) {
  const lines = readFileSync(file, "utf8").split("\n");
  const blocks = [];
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (open === null) {
      if (line === "```" + lang) open = { line: i + 2, body: [] };
      continue;
    }
    if (line === "```") {
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
