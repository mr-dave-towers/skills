import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { checkSkill, extractReferencedFiles, LIMITS } from "../lib/rules.mjs";

/** A body that clears the structural minimums, so content rules are what fail. */
const GOOD_BODY = [
  "# Title",
  "",
  "One paragraph describing the skill.",
  "",
  "## When to use this",
  "",
  "Trigger conditions.",
  "",
  "## Procedure",
  "",
  "1. Do the thing.",
  "2. Verify it.",
  "",
  "## Output format",
  "",
  "```",
  "the exact shape",
  "```",
  "",
  "## Guardrails",
  "",
  "- Never invent values.",
].join("\n");

/** @param {Record<string, unknown>} data */
const check = (data, body = GOOD_BODY) =>
  checkSkill({ folder: "my-skill", data, body, bodyStartLine: 1 });

const VALID = {
  name: "my-skill",
  description: "Use when a reviewer needs to confirm this rule engine behaves as documented.",
};

const messages = (report) => [...report.errors, ...report.warnings].map((item) => item.message);

describe("checkSkill — name", () => {
  test("accepts a well-formed name that matches the folder", () => {
    const report = checkSkill({
      folder: "code-review",
      data: { ...VALID, name: "code-review" },
      body: GOOD_BODY,
    });
    assert.deepEqual(report.errors, []);
  });

  test("errors when name is missing", () => {
    const report = check({ description: VALID.description });
    assert.equal(report.errors.length, 1);
    assert.match(report.errors[0].message, /Missing `name`/);
  });

  test("errors when name does not match the folder", () => {
    const report = check({ ...VALID, name: "other-name" });
    assert.match(report.errors[0].message, /must exactly match the skill folder/);
  });

  test("errors on uppercase and underscores", () => {
    for (const name of ["My_Skill", "my_skill", "-leading", "trailing-", "double--hyphen"]) {
      const report = check({ ...VALID, name });
      assert.ok(
        report.errors.some((item) => /lowercase letters, digits and single hyphens/.test(item.message)),
        `expected a pattern error for ${name}`,
      );
    }
  });

  test("errors when name exceeds 64 characters", () => {
    const report = check({ ...VALID, name: "a".repeat(LIMITS.NAME_MAX + 1) });
    assert.ok(report.errors.some((item) => /the maximum is 64/.test(item.message)));
  });

  test("errors when name is not a string", () => {
    const report = check({ ...VALID, name: 42 });
    assert.ok(report.errors.some((item) => /must be a string/.test(item.message)));
  });
});

describe("checkSkill — description", () => {
  test("accepts a trigger-phrased description", () => {
    assert.deepEqual(check(VALID).errors, []);
  });

  test("errors when description is missing", () => {
    const report = check({ name: VALID.name });
    assert.ok(report.errors.some((item) => /Missing `description`/.test(item.message)));
  });

  test("errors when description is empty", () => {
    const report = check({ ...VALID, description: "   " });
    assert.ok(report.errors.some((item) => /`description` is empty/.test(item.message)));
  });

  test("errors when description exceeds 1024 characters", () => {
    const report = check({ ...VALID, description: `Use when ${"x".repeat(1024)}` });
    assert.ok(report.errors.some((item) => /the maximum is 1024/.test(item.message)));
  });

  test("warns when description is too short to route on", () => {
    const report = check({ ...VALID, description: "Use when x." });
    assert.ok(report.warnings.some((item) => /chars\. It needs enough text/.test(item.message)));
  });

  test("warns when description has no trigger phrase", () => {
    const report = check({
      ...VALID,
      description: "A helpful skill for reviewing pull requests and diffs in a repository.",
    });
    assert.ok(report.warnings.some((item) => /trigger phrase/.test(item.message)));
    assert.equal(report.errors.length, 0);
  });

  test("accepts the Use ONLY when form", () => {
    const report = check({
      ...VALID,
      description: "Use ONLY when the user explicitly asks for a release note entry.",
    });
    assert.equal(report.warnings.length, 0);
  });

  test("warns on first person", () => {
    const report = check({ ...VALID, description: "I help you review pull requests quickly." });
    assert.ok(report.warnings.some((item) => /first person/.test(item.message)));
  });
});

describe("checkSkill — optional keys", () => {
  test("warns on an unknown top-level key", () => {
    const report = check({ ...VALID, licence: "MIT" });
    assert.ok(report.warnings.some((item) => /Unknown frontmatter key "licence"/.test(item.message)));
  });

  test("accepts a string metadata map", () => {
    const report = check({ ...VALID, metadata: { author: "@you", version: "1.0.0" } });
    assert.equal(report.warnings.length, 0);
  });

  test("warns on non-string metadata values", () => {
    const report = check({ ...VALID, metadata: { version: 1.0 } });
    assert.ok(
      report.warnings.some((item) => /`metadata.version` must be a string/.test(item.message)),
    );
  });

  test("accepts compatibility as a list or a string", () => {
    assert.equal(check({ ...VALID, compatibility: ["opencode"] }).warnings.length, 0);
    assert.equal(check({ ...VALID, compatibility: "opencode" }).warnings.length, 0);
  });

  test("warns when compatibility is a nested map", () => {
    const report = check({ ...VALID, compatibility: { opencode: true } });
    assert.ok(report.warnings.some((item) => /`compatibility` must be a string or a list/.test(item.message)));
  });
});

describe("checkSkill — body", () => {
  test("errors on an empty body", () => {
    const report = check(VALID, "   \n\n");
    assert.ok(report.errors.some((item) => /body is empty/.test(item.message)));
  });

  test("errors when the body is below the minimum length", () => {
    const report = check(VALID, "# Title\n\nToo short.\n");
    assert.ok(report.errors.some((item) => /at least inputs, procedure/.test(item.message)));
  });

  test("warns when there is no h1", () => {
    const report = check(VALID, GOOD_BODY.replace("# Title", "## Title"));
    assert.ok(report.warnings.some((item) => /no `# Title` heading/.test(item.message)));
  });

  test("warns when the body exceeds 500 lines", () => {
    const report = check(VALID, `${GOOD_BODY}\n${"filler\n".repeat(600)}`);
    assert.ok(report.warnings.some((item) => /soft ceiling is 500/.test(item.message)));
  });

  test("errors on a credential in the body", () => {
    const report = check(VALID, `${GOOD_BODY}\nUse ${"sk-" + "a".repeat(32)} as the key.`);
    assert.ok(report.errors.some((item) => /looks like a credential/.test(item.message)));
  });

  test("warns on an absolute path in the body", () => {
    const report = check(VALID, `${GOOD_BODY}\nRead /home/david/project/notes.md first.`);
    assert.ok(report.warnings.some((item) => /absolute path/.test(item.message)));
  });

  test("does not warn about a relative path in the body", () => {
    const report = check(VALID, `${GOOD_BODY}\nRead src/auth/session.ts first.`);
    assert.equal(
      report.warnings.filter((item) => /absolute path/.test(item.message)).length,
      0,
    );
  });
});

describe("extractReferencedFiles", () => {
  test("collects relative markdown links", () => {
    const found = extractReferencedFiles("See [the checklist](./references/checklist.md).");
    assert.deepEqual(found, ["references/checklist.md"]);
  });

  test("collects code spans that live in a skill-owned directory", () => {
    const found = extractReferencedFiles("Run `scripts/collect.sh` then read `references/a.md`.");
    assert.deepEqual(found, ["references/a.md", "scripts/collect.sh"]);
  });

  test("ignores code spans that are examples from the user's repo", () => {
    assert.deepEqual(extractReferencedFiles("Edit `src/auth/session.ts` and `lib/utils.ts`."), []);
  });

  test("ignores urls, anchors, absolute paths, and parent traversal", () => {
    const found = extractReferencedFiles(
      [
        "[a](https://example.com/x.md)",
        "[b](#section)",
        "[c](/etc/passwd)",
        "[d](../outside.md)",
        "`/usr/local/bin/tool.sh`",
      ].join("\n"),
    );
    assert.deepEqual(found, []);
  });

  test("strips anchors and query strings", () => {
    assert.deepEqual(extractReferencedFiles("[a](./references/x.md#part-two)"), [
      "references/x.md",
    ]);
  });

  test("returns a sorted, deduplicated list", () => {
    const found = extractReferencedFiles(
      "`references/b.md` `references/a.md` [again](./references/b.md)",
    );
    assert.deepEqual(found, ["references/a.md", "references/b.md"]);
  });
});

describe("checkSkill — report shape", () => {
  test("returns referenced files alongside diagnostics", () => {
    const report = check(VALID, `${GOOD_BODY}\n\nSee [checklist](./references/checklist.md).`);
    assert.deepEqual(report.referencedFiles, ["references/checklist.md"]);
    assert.equal(report.folder, "my-skill");
  });

  test("produces no diagnostics for a clean skill", () => {
    const report = check(VALID);
    assert.deepEqual(messages(report), []);
  });
});
