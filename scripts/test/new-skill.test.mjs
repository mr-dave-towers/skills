import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, chmod, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, describe, before, after } from "node:test";

import { main as scaffold } from "../new-skill.mjs";
import { parseFrontmatter } from "../lib/frontmatter.mjs";

/** @type {string} */
let dir;

/**
 * Run the CLI with its output captured through the injectable sink, so the
 * test reporter's own stdout writes are never intercepted.
 */
async function run(argv) {
  const out = [];
  const err = [];
  const sink = (target) => ({ write: (chunk) => (target.push(String(chunk)), true) });
  const code = await scaffold({
    argv,
    stdout: sink(out),
    stderr: sink(err),
  });
  return { code, stdout: out.join(""), stderr: err.join("") };
}

const DESCRIPTION = "Use when a fixture exercises the scaffolder end to end.";
const base = (extra = []) => ["--dir", dir, "--description", DESCRIPTION, ...extra];

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "skills-new-"));
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("skills-new", () => {
  test("creates SKILL.md with the name and description rendered", async () => {
    const result = await run([...base(), "demo-skill", "--author", "@tester"]);
    assert.equal(result.code, 0, result.stderr);

    const source = await readFile(path.join(dir, "demo-skill", "SKILL.md"), "utf8");
    const parsed = parseFrontmatter(source);
    assert.equal(parsed.ok, true, parsed.errors.map((item) => item.message).join("\n"));
    assert.equal(parsed.data.name, "demo-skill");
    assert.equal(parsed.data.description, DESCRIPTION);
    assert.equal(parsed.data.license, "MIT");
    assert.equal(parsed.data.metadata.author, "@tester");
    assert.match(parsed.body, /# Demo Skill/);
  });

  test("leaves no unreplaced placeholders", async () => {
    await run([...base(), "placeholder-check"]);
    const source = await readFile(path.join(dir, "placeholder-check", "SKILL.md"), "utf8");
    assert.doesNotMatch(source, /\{\{/);
  });

  test("honours --license and --compatibility", async () => {
    await run([...base(), "meta-skill", "--license", "Apache-2.0", "--compatibility", "opencode"]);
    const source = await readFile(path.join(dir, "meta-skill", "SKILL.md"), "utf8");
    const parsed = parseFrontmatter(source);
    assert.equal(parsed.ok, true, parsed.errors.map((item) => item.message).join("\n"));
    assert.equal(parsed.data.license, "Apache-2.0");
    assert.equal(parsed.data.compatibility, "opencode");
  });

  test("omits compatibility and author when they are not supplied", async () => {
    await run([...base(), "bare-skill"]);
    const source = await readFile(path.join(dir, "bare-skill", "SKILL.md"), "utf8");
    const parsed = parseFrontmatter(source);
    assert.equal(parsed.ok, true, parsed.errors.map((item) => item.message).join("\n"));
    assert.ok(!("compatibility" in parsed.data), "compatibility should be absent");
    assert.ok(!("author" in (parsed.data.metadata ?? {})), "metadata.author should be absent");
    assert.doesNotMatch(source, /^compatibility:/m);
  });

  test("rejects an invalid name with exit code 2", async () => {
    for (const name of ["BadName", "has_underscore", "trailing-", "double--hyphen", "with space"]) {
      const result = await run([...base(), name]);
      assert.equal(result.code, 2, `expected rejection for ${name}`);
      assert.match(result.stderr, /Invalid skill name/);
    }
  });

  test("rejects a name that looks like a flag", async () => {
    const result = await run([...base(), "-leading"]);
    assert.equal(result.code, 2);
  });

  test("rejects a name longer than 64 characters", async () => {
    const result = await run([...base(), "a".repeat(65)]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /maximum is 64/);
  });

  test("creates the requested reference and script stubs", async () => {
    const result = await run([
      ...base(),
      "stub-skill",
      "--references",
      "checklist.md, house-style.md",
      "--scripts",
      "collect.sh",
    ]);
    assert.equal(result.code, 0, result.stderr);

    const root = path.join(dir, "stub-skill");
    assert.ok(existsSync(path.join(root, "references", "checklist.md")));
    assert.ok(existsSync(path.join(root, "references", "house-style.md")));
    assert.ok(existsSync(path.join(root, "scripts", "collect.sh")));

    const script = await readFile(path.join(root, "scripts", "collect.sh"), "utf8");
    assert.match(script, /^#!\/usr\/bin\/env bash/);
  });

  test("refuses to overwrite without --force", async () => {
    await run([...base(), "existing-skill"]);
    const second = await run([...base(), "existing-skill"]);
    assert.equal(second.code, 1);
    assert.match(second.stderr, /already exists/);

    const third = await run([...base(), "existing-skill", "--force"]);
    assert.equal(third.code, 0, third.stderr);
  });

  test("rejects a missing name", async () => {
    const result = await run(["--description", DESCRIPTION]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /Missing <skill-name>/);
  });

  test("rejects an unknown flag", async () => {
    const result = await run(["--nope", "some-skill"]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /Usage: skills-new/);
  });

  test("--dry-run writes nothing", async () => {
    const result = await run([...base(), "dry-skill", "--dry-run"]);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Would create/);
    assert.equal(existsSync(path.join(dir, "dry-skill")), false);
  });

  test("reports a failing validation after scaffolding", async () => {
    const templateDir = path.join(dir, "broken-template");
    await import("node:fs/promises").then((fs) => fs.mkdir(templateDir, { recursive: true }));
    await writeFile(
      path.join(templateDir, "SKILL.md"),
      "---\nname: {{name}}\ndescription: {{description}}\n---\n\nshort\n",
    );

    const result = await run([
      ...base(),
      "broken-skill",
      "--from",
      templateDir,
    ]);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /FAIL broken-skill/);
    assert.match(result.stderr, /validation errors/);
  });

  test("errors when the template is missing", async () => {
    const result = await run([...base(), "no-template", "--from", path.join(dir, "nope")]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /No template at/);
  });

  test("--help exits 0", async () => {
    const result = await run(["--help"]);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /Usage: skills-new <skill-name>/);
  });
});
