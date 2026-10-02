import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { parseFrontmatter, isPlainObject } from "../lib/frontmatter.mjs";

const wrap = (frontmatter, body = "\n# Title\n") =>
  `---\n${frontmatter}\n---\n${body}`;

describe("parseFrontmatter", () => {
  test("parses the minimal required keys", () => {
    const result = parseFrontmatter(
      wrap("name: my-skill\ndescription: Use when testing the parser."),
    );
    assert.equal(result.ok, true);
    assert.equal(result.data.name, "my-skill");
    assert.equal(result.data.description, "Use when testing the parser.");
    assert.match(result.body, /# Title/);
  });

  test("reports the line where the body starts", () => {
    const result = parseFrontmatter(wrap("name: a\ndescription: b"));
    assert.equal(result.bodyStartLine, 5);
  });

  test("errors when there is no frontmatter", () => {
    const result = parseFrontmatter("# Just markdown\n");
    assert.equal(result.ok, false);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /missing YAML frontmatter/);
    assert.equal(result.body, "# Just markdown\n");
  });

  test("errors when frontmatter is never closed", () => {
    const result = parseFrontmatter("---\nname: a\ndescription: b\n");
    assert.equal(result.ok, false);
    assert.match(result.errors[0].message, /never closed/);
  });

  test("strips a trailing comment but keeps a # inside quotes", () => {
    const result = parseFrontmatter(
      wrap('name: a # the name\ndescription: "Use when #1 ships."'),
    );
    assert.equal(result.ok, true);
    assert.equal(result.data.name, "a");
    assert.equal(result.data.description, "Use when #1 ships.");
  });

  test("keeps a # that is not preceded by whitespace", () => {
    const result = parseFrontmatter(wrap("name: a\ndescription: Use when url#anchor is given."));
    assert.equal(result.data.description, "Use when url#anchor is given.");
  });

  test("parses a nested map and coerces scalars", () => {
    const result = parseFrontmatter(
      wrap(
        [
          "name: a-skill",
          "description: Use when testing nested metadata.",
          "license: MIT",
          "metadata:",
          '  author: "@you"',
          "  version: 1.0.0",
          "  draft: true",
          "  count: 3",
        ].join("\n"),
      ),
    );
    assert.equal(result.ok, true);
    assert.equal(result.data.license, "MIT");
    assert.deepEqual(result.data.metadata, {
      author: "@you",
      version: "1.0.0",
      draft: true,
      count: 3,
    });
  });

  test("parses a block list", () => {
    const result = parseFrontmatter(
      wrap("name: a-skill\ndescription: Use when listing.\ncompatibility:\n  - opencode\n  - codex"),
    );
    assert.deepEqual(result.data.compatibility, ["opencode", "codex"]);
  });

  test("parses a comma-separated value as a plain string", () => {
    const result = parseFrontmatter(
      wrap("name: a-skill\ndescription: Use when listing.\ncompatibility: opencode, codex"),
    );
    assert.equal(result.data.compatibility, "opencode, codex");
  });

  test("unescapes double-quoted strings", () => {
    const result = parseFrontmatter(wrap('name: a-skill\ndescription: "a \\"b\\" c"'));
    assert.equal(result.data.description, 'a "b" c');
  });

  test("resolves doubled single quotes", () => {
    const result = parseFrontmatter(wrap("name: a-skill\ndescription: 'it''s fine'"));
    assert.equal(result.data.description, "it's fine");
  });

  test("treats a key with no value as null", () => {
    const result = parseFrontmatter(wrap("name: a-skill\ndescription: Use when x.\nmetadata:"));
    assert.equal(result.data.metadata, null);
  });

  test("errors on a duplicate key", () => {
    const result = parseFrontmatter(
      wrap("name: a-skill\ndescription: Use when x.\nname: other"),
    );
    assert.equal(result.ok, false);
    assert.match(result.errors[0].message, /duplicate key "name"/);
  });

  test("errors on a line that is not key: value", () => {
    const result = parseFrontmatter(wrap("name: a-skill\njust some prose\ndescription: x"));
    assert.equal(result.ok, false);
    assert.match(result.errors[0].message, /expected `key: value`/);
  });

  test("errors on flow-style YAML instead of mis-parsing it", () => {
    const result = parseFrontmatter(
      wrap("name: a-skill\ndescription: Use when x.\nmetadata: {author: you}"),
    );
    assert.equal(result.ok, false);
    assert.match(result.errors[0].message, /flow-style YAML/);
  });

  test("errors on an unterminated double quote", () => {
    const result = parseFrontmatter(wrap('name: a-skill\ndescription: "unclosed'));
    assert.equal(result.ok, false);
    assert.match(result.errors[0].message, /unterminated double-quoted string/);
  });

  test("rejects tab indentation", () => {
    const result = parseFrontmatter(
      wrap("name: a-skill\ndescription: Use when x.\nmetadata:\n\tauthor: you"),
    );
    assert.equal(result.ok, false);
    assert.match(result.errors[0].message, /tab indentation/);
  });

  test("tolerates CRLF line endings", () => {
    const result = parseFrontmatter("---\r\nname: a-skill\r\ndescription: Use when x.\r\n---\r\n# T\r\n");
    assert.equal(result.ok, true);
    assert.equal(result.data.name, "a-skill");
  });

  test("tolerates a leading byte order mark", () => {
    const result = parseFrontmatter("\uFEFF---\nname: a-skill\ndescription: Use when x.\n---\n");
    assert.equal(result.ok, true);
    assert.equal(result.data.name, "a-skill");
  });

  test("records the filename and line number in diagnostics", () => {
    const result = parseFrontmatter(wrap("name: a-skill\nbroken line here"), {
      filename: "skills/x/SKILL.md",
    });
    assert.equal(result.errors[0].line, 3);
    assert.match(result.errors[0].message, /^skills\/x\/SKILL\.md:3:/);
  });

  test("errors on an over-long unclosed frontmatter block", () => {
    const filler = Array.from({ length: 210 }, (_, i) => `k${i}: v`).join("\n");
    const result = parseFrontmatter(`---\n${filler}\n`);
    assert.equal(result.ok, false);
    assert.match(result.errors[0].message, /not closed within/);
  });
});

describe("isPlainObject", () => {
  test("accepts object literals", () => {
    assert.equal(isPlainObject({}), true);
  });

  test("rejects arrays, null, and primitives", () => {
    assert.equal(isPlainObject([]), false);
    assert.equal(isPlainObject(null), false);
    assert.equal(isPlainObject("x"), false);
  });
});
