import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, describe, after, before } from "node:test";

import { validateFolders, renderText } from "../validate.mjs";

const VALID_BODY = [
  "# Title",
  "",
  "Does a thing.",
  "",
  "## When to use this",
  "",
  "When the thing is needed.",
  "",
  "## Procedure",
  "",
  "1. Step one.",
  "2. Step two.",
  "",
  "## Output format",
  "",
  "```",
  "output",
  "```",
  "",
  "## Guardrails",
  "",
  "- Never guess.",
].join("\n");

/** @type {string} */
let dir;

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "skills-validate-"));

  const skill = async (name, frontmatter, body = VALID_BODY) => {
    const folder = path.join(dir, name);
    await mkdir(folder, { recursive: true });
    const contents =
      frontmatter === null ? body : `---\n${frontmatter}\n---\n\n${body}\n`;
    await writeFile(path.join(folder, "SKILL.md"), contents);
    return folder;
  };

  await skill(
    "good-skill",
    "name: good-skill\ndescription: Use when a fixture must pass validation end to end.",
  );
  await skill("no-frontmatter", null, "# Just markdown\n");
  await mkdir(path.join(dir, "empty-folder"), { recursive: true });
  await skill(
    "bad-name",
    "name: something-else\ndescription: Use when a fixture must fail the folder match rule.",
  );
  await skill(
    "missing-ref",
    "name: missing-ref\ndescription: Use when a fixture references a file that does not exist.",
    `${VALID_BODY}\n\nSee [the checklist](./references/checklist.md).`,
  );
  await skill(
    "good-ref",
    "name: good-ref\ndescription: Use when a fixture references a file that does exist.",
    `${VALID_BODY}\n\nSee [the checklist](./references/checklist.md).`,
  );
  await mkdir(path.join(dir, "good-ref", "references"), { recursive: true });
  await writeFile(path.join(dir, "good-ref", "references", "checklist.md"), "# Checklist\n");
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Resolved lazily: `before` populates `dir` after this module is evaluated. */
const at = (name) => path.join(dir, name);

/** The real README does not index these fixtures, so opt out of that rule. */
const NO_INDEX = { readme: "" };

describe("validateFolders", () => {
  test("passes a well-formed skill", async () => {
    const [report] = await validateFolders([at("good-skill")], NO_INDEX);
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.warnings, []);
    assert.equal(report.folder, "good-skill");
  });

  test("errors on a file with no frontmatter", async () => {
    const [report] = await validateFolders([at("no-frontmatter")], NO_INDEX);
    assert.ok(report.errors.some((item) => /missing YAML frontmatter/.test(item.message)));
  });

  test("errors when SKILL.md is absent", async () => {
    const [report] = await validateFolders([at("empty-folder")], NO_INDEX);
    assert.equal(report.errors.length, 1);
    assert.match(report.errors[0].message, /Missing SKILL\.md/);
  });

  test("errors when name does not match the folder", async () => {
    const [report] = await validateFolders([at("bad-name")], NO_INDEX);
    assert.ok(report.errors.some((item) => /must exactly match the skill folder/.test(item.message)));
  });

  test("errors on a referenced file that does not exist", async () => {
    const [report] = await validateFolders([at("missing-ref")], NO_INDEX);
    assert.ok(
      report.errors.some((item) =>
        /references\/checklist\.md.*does not exist/.test(item.message),
      ),
    );
  });

  test("accepts a referenced file that does exist, normalising ./", async () => {
    const [report] = await validateFolders([at("good-ref")], NO_INDEX);
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.referencedFiles, ["references/checklist.md"]);
  });

  test("warns on a skill missing from the README, and errors in strict mode", async () => {
    const lenient = await validateFolders([at("good-skill")], { readme: "# No index here" });
    assert.equal(lenient[0].errors.length, 0);
    assert.ok(lenient[0].warnings.some((item) => /not listed in README/.test(item.message)));

    const strict = await validateFolders([at("good-skill")], { readme: "# No index here", strict: true });
    assert.ok(strict[0].errors.some((item) => /not listed in README/.test(item.message)));
  });

  test("accepts a README index that links the skill", async () => {
    const readme = "| code | [x](./skills/good-skill/SKILL.md) |";
    const reports = await validateFolders([at("good-skill")], { readme, strict: true });
    assert.deepEqual(reports[0].errors, []);
    assert.deepEqual(reports[0].warnings, []);
  });

  test("returns a report per folder", async () => {
    const names = [
      "good-skill",
      "no-frontmatter",
      "empty-folder",
      "bad-name",
      "missing-ref",
      "good-ref",
    ];
    const reports = await validateFolders(names.map(at), NO_INDEX);
    assert.deepEqual(
      reports.map((report) => report.folder),
      names,
    );
  });
});

describe("renderText", () => {
  test("marks a clean skill PASS", async () => {
    const reports = await validateFolders([at("good-skill")], NO_INDEX);
    const text = renderText(reports);
    assert.match(text, /PASS good-skill/);
    assert.match(text, /All skills are valid\./);
  });

  test("lists errors and warnings for a failing skill", async () => {
    const reports = await validateFolders([at("bad-name")], NO_INDEX);
    const text = renderText(reports);
    assert.match(text, /FAIL bad-name/);
    assert.match(text, /error\s+`name` \("something-else"\) must exactly match/);
  });

  test("prints no ANSI codes when color is disabled", async () => {
    const reports = await validateFolders([at("good-skill")], NO_INDEX);
    assert.doesNotMatch(renderText(reports, { color: false }), /\[/);
  });

  test("emits ANSI codes when color is enabled", async () => {
    const reports = await validateFolders([at("good-skill")], NO_INDEX);
    assert.match(renderText(reports, { color: true }), /\[32mPASS/);
  });
});
