/**
 * Minimal, dependency-free frontmatter parser for SKILL.md files.
 *
 * It deliberately supports only the small YAML subset that agent skill
 * frontmatter needs:
 *
 *   - scalars: bare, single-quoted, double-quoted
 *   - booleans, null, and numbers coerced to native types
 *   - `# comments` (full-line and trailing, when preceded by whitespace)
 *   - block mappings, nestable by indentation
 *   - block sequences (`- item`)
 *
 * Anything else (anchors, multi-line scalars, flow collections, multiple
 * documents) is reported as an error rather than silently mis-parsed, so a
 * malformed SKILL.md fails loudly instead of loading half-empty.
 */

const FENCE_RE = /^---\s*$/;
const KEY_RE = /^([A-Za-z0-9_.$-]+)\s*:(?:\s+(.*))?$/;
const SEQ_RE = /^-(?:\s+(.*))?$/;

const MAX_FRONTMATTER_LINES = 200;

/**
 * @typedef {{ severity: "error" | "warning", message: string, line: number }} Diagnostic
 * @typedef {{
 *   ok: boolean,
 *   data: Record<string, unknown>,
 *   body: string,
 *   // 1-based line number in the source where `body` starts.
 *   bodyStartLine: number,
 *   errors: Diagnostic[],
 *   warnings: Diagnostic[],
 * }} ParseResult
 */

/**
 * Parse a markdown document that may start with YAML frontmatter.
 *
 * A document without frontmatter is not a hard parse failure: it returns
 * `ok: false` with a single error and the full text as `body`, so callers can
 * report a useful message while still working with the content.
 *
 * @param {string} source
 * @param {{ filename?: string }} [options]
 * @returns {ParseResult}
 */
export function parseFrontmatter(source, options = {}) {
  const filename = options.filename ?? "<input>";
  const text = String(source).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/);
  const errors = [];
  const warnings = [];

  const fail = (line, message) => {
    errors.push({ severity: "error", message: `${filename}:${line}: ${message}`, line });
  };

  if (lines.length === 0 || !FENCE_RE.test(lines[0] ?? "")) {
    fail(
      1,
      "missing YAML frontmatter. A SKILL.md must start with a `---` line " +
        "followed by `name:` and `description:` keys.",
    );
    return { ok: false, data: {}, body: text, bodyStartLine: 1, errors, warnings };
  }

  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i]) || /^---\s*$/.test(lines[i])) {
      closingIndex = i;
      break;
    }
    if (i > MAX_FRONTMATTER_LINES) {
      fail(1, `frontmatter is not closed within ${MAX_FRONTMATTER_LINES} lines.`);
      return { ok: false, data: {}, body: "", bodyStartLine: 1, errors, warnings };
    }
  }

  if (closingIndex === -1) {
    fail(1, "frontmatter is never closed. Add a `---` line after the last key.");
    return { ok: false, data: {}, body: "", bodyStartLine: 1, errors, warnings };
  }

  const frontmatterLines = lines.slice(1, closingIndex);
  const { value, errors: parseErrors } = parseBlock(frontmatterLines, 2, fail);

  errors.push(...parseErrors);
  if (value && !isPlainObject(value)) {
    fail(1, "frontmatter must be a mapping of keys to values.");
  }

  const body = lines.slice(closingIndex + 1).join("\n");
  const bodyStartLine = closingIndex + 2;

  return {
    ok: errors.length === 0,
    data: isPlainObject(value) ? value : {},
    body,
    bodyStartLine,
    errors,
    warnings,
  };
}

/**
 * @param {string[]} lines
 * @param {number} offset 1-based line number of `lines[0]` in the source file.
 * @param {(line: number, message: string) => void} fail
 */
function parseBlock(lines, offset, fail) {
  const entries = [];
  let dedent = null;

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = offset + i;
    const raw = lines[i];

    if (raw.includes("\t")) {
      fail(lineNumber, "tab indentation is not supported in frontmatter. Use spaces.");
    }

    const stripped = stripComment(raw);
    if (stripped.trim() === "") continue;

    const indent = stripped.length - stripped.trimStart().length;
    if (dedent === null) dedent = indent;
    if (indent % 2 !== 0 && dedent % 2 !== 0) {
      // Non-multiple-of-two indentation is legal YAML but a strong smell in
      // hand-written frontmatter; keep it, just note it.
    }

    entries.push({ indent, content: stripped.trim(), line: lineNumber });
  }

  if (entries.length === 0) return { value: {}, errors: [] };

  const { node, next, errors } = parseNode(entries, 0, entries[0].indent, fail);
  if (next < entries.length) {
    fail(
      entries[next].line,
      `unexpected indentation. This line is indented ${entries[next].indent} spaces ` +
        `but the block it belongs to is at ${entries[next - 1]?.indent ?? 0}.`,
    );
  }
  return { value: node, errors };
}

/**
 * @param {typeof entries extends never ? never : any[]} entries
 * @param {number} start
 * @param {number} indent
 * @param {(line: number, message: string) => void} fail
 */
function parseNode(entries, start, indent, fail) {
  const errors = [];
  const first = entries[start];
  if (!first) return { node: null, next: start, errors };

  if (SEQ_RE.test(first.content)) {
    const items = [];
    let i = start;
    while (i < entries.length) {
      const entry = entries[i];
      if (entry.indent < indent) break;
      if (entry.indent > indent) {
        fail(entry.line, "unexpected extra indentation inside a list item.");
        i++;
        continue;
      }
      const match = SEQ_RE.exec(entry.content);
      if (!match) {
        fail(entry.line, `expected a list item starting with "- ", found: ${entry.content}`);
        i++;
        continue;
      }
      items.push(parseScalar(match[1] ?? "", entry.line, fail, errors));
      i++;
    }
    return { node: items, next: i, errors };
  }

  /** @type {Record<string, unknown>} */
  const map = {};
  const seen = new Map();
  let i = start;
  while (i < entries.length) {
    const entry = entries[i];
    if (entry.indent < indent) break;
    if (entry.indent > indent) {
      fail(entry.line, "unexpected extra indentation. Check the YAML nesting.");
      i++;
      continue;
    }

    const match = KEY_RE.exec(entry.content);
    if (!match) {
      fail(entry.line, `expected \`key: value\`, found: ${entry.content}`);
      i++;
      continue;
    }

    const key = match[1];
    const rawValue = match[2];

    if (seen.has(key)) {
      fail(entry.line, `duplicate key "${key}" (first seen on line ${seen.get(key)}).`);
    }
    seen.set(key, entry.line);

    if (rawValue === undefined || rawValue.trim() === "") {
      const child = entries[i + 1];
      if (child && child.indent > indent) {
        const nested = parseNode(entries, i + 1, child.indent, fail);
        map[key] = nested.node;
        i = nested.next;
      } else {
        map[key] = null;
        i++;
      }
      continue;
    }

    map[key] = parseScalar(rawValue, entry.line, fail, errors);
    i++;
  }

  return { node: map, next: i, errors };
}

/**
 * @param {string} raw
 * @param {number} lineNumber
 * @param {(line: number, message: string) => void} fail
 * @param {any[]} errors
 */
function parseScalar(raw, lineNumber, fail, errors) {
  const value = raw.trim();

  if (value.startsWith('"')) {
    if (value.length < 2 || !value.endsWith('"') || unescapedQuoteCount(value) % 2 !== 0) {
      fail(lineNumber, "unterminated double-quoted string.");
      return value.replace(/^"/, "");
    }
    return unescape(value.slice(1, -1));
  }

  if (value.startsWith("'")) {
    if (value.length < 2 || !value.endsWith("'")) {
      fail(lineNumber, "unterminated single-quoted string.");
      return value.replace(/^'/, "");
    }
    return value.slice(1, -1).replace(/''/g, "'");
  }

  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~") return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^-?\d*\.\d+$/.test(value)) return Number(value);

  if (/^[[{]/.test(value)) {
    fail(
      lineNumber,
      `flow-style YAML (\`${value}\`) is not supported. ` +
        "Use a block list (`- item`) or an indented block instead.",
    );
    return value;
  }

  return value;
}

function unescapedQuoteCount(value) {
  let count = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '"' && value[i - 1] !== "\\") count++;
  }
  return count;
}

function unescape(value) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

/** Strip a trailing `#` comment, respecting quotes. */
function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quote) {
      if (char === "\\" && quote === '"') {
        i++;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "#" && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

/** @param {unknown} value */
export function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
