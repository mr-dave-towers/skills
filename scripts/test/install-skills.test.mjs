import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, stat, lstat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, describe, beforeEach, afterEach } from "node:test";

import { main as install } from "../install-skills.mjs";

async function run(argv, { cwd, home }) {
  const out = [];
  const err = [];
  const sink = (target) => ({ write: (chunk) => (target.push(String(chunk)), true) });
  const code = await install({
    argv,
    cwd,
    home,
    stdout: sink(out),
    stderr: sink(err),
  });
  return { code, stdout: out.join(""), stderr: err.join("") };
}

describe("skills-install", () => {
  let home;
  let cwd;
  let skillsDir;

  beforeEach(async () => {
    home = await mkdtemp(path.join(tmpdir(), "skills-home-"));
    cwd = await mkdtemp(path.join(tmpdir(), "skills-proj-"));
    skillsDir = await mkdtemp(path.join(tmpdir(), "skills-lib-"));
    await mkdir(path.join(skillsDir, "one"));
    await writeFile(path.join(skillsDir, "one", "SKILL.md"), "---\nname: one\ndescription: d1\n---\n");
    await mkdir(path.join(skillsDir, "one", "references"));
    await writeFile(path.join(skillsDir, "one", "references", "x.md"), "# x\n");
    await mkdir(path.join(skillsDir, "two"));
    await writeFile(path.join(skillsDir, "two", "SKILL.md"), "---\nname: two\ndescription: d2\n---\n");
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
    await rm(skillsDir, { recursive: true, force: true });
  });

  test("copies whole folder with references", async () => {
    const result = await run(["--dir", skillsDir, "one"], { cwd, home });
    assert.equal(result.code, 0, result.stderr);
    assert.ok(existsSync(path.join(cwd, ".opencode", "skills", "one", "SKILL.md")));
    assert.ok(existsSync(path.join(cwd, ".opencode", "skills", "one", "references", "x.md")));
    const st = await stat(path.join(cwd, ".opencode", "skills", "one"));
    assert.ok(st.isDirectory());
  });

  test("symlinks with --link", async () => {
    const result = await run(["--dir", skillsDir, "--link", "one"], { cwd, home });
    assert.equal(result.code, 0, result.stderr);
    const st = await lstat(path.join(cwd, ".opencode", "skills", "one"));
    assert.ok(st.isSymbolicLink());
  });

  test("defaults to project opencode", async () => {
    const result = await run(["--dir", skillsDir, "one"], { cwd, home });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /opencode/);
    assert.match(result.stdout, /\.opencode\/skills/);
  });

  test("global scope for claude", async () => {
    const result = await run(["--dir", skillsDir, "--agent", "claude", "--scope", "global", "one"], { cwd, home });
    assert.equal(result.code, 0, result.stderr);
    assert.ok(existsSync(path.join(home, ".claude", "skills", "one", "SKILL.md")));
  });

  test("all agents project", async () => {
    const result = await run(["--dir", skillsDir, "--agent", "all"], { cwd, home });
    assert.equal(result.code, 0, result.stderr);
    assert.ok(existsSync(path.join(cwd, ".opencode", "skills", "one")));
    assert.ok(existsSync(path.join(cwd, ".claude", "skills", "one")));
    assert.ok(existsSync(path.join(cwd, ".agents", "skills", "one")));
  });

  test("all agents global", async () => {
    const result = await run(["--dir", skillsDir, "--agent", "all", "--scope", "global"], { cwd, home });
    assert.equal(result.code, 0, result.stderr);
    assert.ok(existsSync(path.join(home, ".config", "opencode", "skills", "one")));
    assert.ok(existsSync(path.join(home, ".claude", "skills", "one")));
    assert.ok(existsSync(path.join(home, ".agents", "skills", "one")));
  });

  test("explicit target", async () => {
    const target = path.join(cwd, "custom-skills");
    const result = await run(["--dir", skillsDir, "--target", target, "one"], { cwd, home });
    assert.equal(result.code, 0, result.stderr);
    assert.ok(existsSync(path.join(target, "one", "SKILL.md")));
  });

  test("conflict without force", async () => {
    await run(["--dir", skillsDir, "one"], { cwd, home });
    const second = await run(["--dir", skillsDir, "one"], { cwd, home });
    assert.equal(second.code, 1);
    assert.match(second.stderr, /already exists/);
  });

  test("force overwrites", async () => {
    await run(["--dir", skillsDir, "one"], { cwd, home });
    const second = await run(["--dir", skillsDir, "one", "--force"], { cwd, home });
    assert.equal(second.code, 0, second.stderr);
  });

  test("unknown skill", async () => {
    const result = await run(["--dir", skillsDir, "nope"], { cwd, home });
    assert.equal(result.code, 2);
    assert.match(result.stderr, /Unknown skill/);
  });

  test("--list shows nothing installed", async () => {
    const result = await run(["--dir", skillsDir, "--list"], { cwd, home });
    assert.equal(result.code, 0);
    assert.match(result.stdout, /No library skills installed yet/);
  });

  test("--list shows installed", async () => {
    await run(["--dir", skillsDir, "one"], { cwd, home });
    const result = await run(["--dir", skillsDir, "--list"], { cwd, home });
    assert.equal(result.code, 0);
    assert.match(result.stdout, /copy/);
    assert.match(result.stdout, /one/);
  });

  test("dry-run does not write", async () => {
    const result = await run(["--dir", skillsDir, "one", "--dry-run"], { cwd, home });
    assert.equal(result.code, 0);
    assert.match(result.stdout, /Would install/);
    assert.equal(existsSync(path.join(cwd, ".opencode", "skills", "one")), false);
  });

  test("installs all by default", async () => {
    const result = await run(["--dir", skillsDir], { cwd, home });
    assert.equal(result.code, 0, result.stderr);
    assert.ok(existsSync(path.join(cwd, ".opencode", "skills", "one")));
    assert.ok(existsSync(path.join(cwd, ".opencode", "skills", "two")));
  });

  test("rejects bad scope", async () => {
    const result = await run(["--dir", skillsDir, "--scope", "bad"], { cwd, home });
    assert.equal(result.code, 2);
    assert.match(result.stderr, /Invalid --scope/);
  });

  test("rejects bad agent", async () => {
    const result = await run(["--dir", skillsDir, "--agent", "unknown"], { cwd, home });
    assert.equal(result.code, 2);
    assert.match(result.stderr, /Unknown --agent/);
  });
});
