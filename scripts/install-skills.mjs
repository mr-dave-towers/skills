#!/usr/bin/env node
/**
 * Install skills into an agent's skills directory.
 *
 *   skills-install                                   # every skill → .opencode/skills/
 *   skills-install code-review frontend-design       # only those two
 *   skills-install --agent claude --scope global     # → ~/.claude/skills/
 *   skills-install --link                            # symlink instead of copy
 *   skills-install --list                            # show what is installed where
 *   skills-install --agent all --scope global
 *
 * Copies whole skill folders, never a bare SKILL.md: a skill that points at
 * `./references/checklist.md` silently loses that file if only SKILL.md moves.
 *
 * Exit codes: 0 = installed, 1 = conflict or refused, 2 = bad usage.
 */

import { chmod, copyFile, lstat, mkdir, readdir, readlink, rm, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { parseArgs } from "node:util";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_SKILLS_DIR = path.join(ROOT, "skills");
const SKILL_FILE = "SKILL.md";

/**
 * Where each agent looks for skills, per scope. opencode additionally reads the
 * `.claude/` and `.agents/` project folders, so those are listed as shadowing
 * locations rather than install targets.
 */
const AGENTS = {
  opencode: {
    label: "opencode",
    project: [".opencode/skills"],
    global: [".config/opencode/skills"],
    reads: [".claude/skills", ".agents/skills"],
  },
  claude: {
    label: "Claude Code",
    project: [".claude/skills"],
    global: [".claude/skills"],
    reads: [],
  },
  codex: {
    label: "Codex",
    global: [".agents/skills"],
    project: [".agents/skills"],
    reads: [],
  },
};

const USAGE = `Usage: skills-install [options] [skill-name ...]

Install skills from ./skills into an agent's skills directory. With no skill
names, every skill in the library is installed.

Options:
  -a, --agent <list>     Comma-separated: opencode, claude, codex, all.
                         Default: opencode.
  -s, --scope <scope>    project (default) or global.
  -t, --target <path>    Explicit destination skills directory. Overrides
                         --agent and --scope.
      --link             Symlink instead of copying. Local use only — the link
                         stores an absolute path and must not be committed.
  -l, --list             List library skills and where they are installed. No writes.
      --dir <path>       Source skills directory. Default: ./skills
  -f, --force            Overwrite an existing installation.
      --dry-run          Print what would happen, then exit.
  -h, --help             Show this help.

Project scope resolves relative to the current directory; global scope uses your
home directory. Restart the agent afterwards — skills load at startup.`;

export const TARGETS = AGENTS;

/**
 * @param {{
 *   argv?: string[],
 *   cwd?: string,
 *   home?: string,
 *   stdout?: { write(chunk: string): unknown },
 *   stderr?: { write(chunk: string): unknown },
 * }} [input]
 * @returns {Promise<number>} the process exit code
 */
export async function main(input = {}) {
  const argv = input.argv ?? process.argv.slice(2);
  const cwd = input.cwd ?? process.cwd();
  const home = input.home ?? homedir();
  const out = input.stdout ?? process.stdout;
  const err = input.stderr ?? process.stderr;
  const say = (text) => out.write(text);
  const complain = (text) => err.write(text);

  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        agent: { type: "string", short: "a" },
        scope: { type: "string", short: "s" },
        target: { type: "string", short: "t" },
        link: { type: "boolean", default: false },
        list: { type: "boolean", short: "l", default: false },
        dir: { type: "string" },
        force: { type: "boolean", short: "f", default: false },
        "dry-run": { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
      allowPositionals: true,
    });
  } catch (error) {
    complain(`${error.message}\n\n${USAGE}\n`);
    return 2;
  }

  if (parsed.values.help) {
    say(`${USAGE}\n`);
    return 0;
  }

  const skillsDir = path.resolve(cwd, parsed.values.dir ?? DEFAULT_SKILLS_DIR);
  if (!existsSync(skillsDir)) {
    complain(`No skills directory at ${skillsDir}\n`);
    return 2;
  }

  const available = await discover(skillsDir);
  if (available.length === 0) {
    complain(`No skills found in ${path.relative(cwd, skillsDir) || "skills"}/\n`);
    return 2;
  }

  if (parsed.values.list) {
    say(await renderList(available, { cwd, home, scope: parsed.values.scope }));
    return 0;
  }

  const requested = parsed.positionals;
  const unknown = requested.filter((name) => !available.includes(name));
  if (unknown.length > 0) {
    complain(
      `Unknown skill${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}\n` +
        `Available: ${available.join(", ")}\n`,
    );
    return 2;
  }
  const names = requested.length > 0 ? requested : available;

  const { targets, error } = resolveTargets({
    values: parsed.values,
    cwd,
    home,
  });
  if (error) {
    complain(`${error}\n\n${USAGE}\n`);
    return 2;
  }

  const link = parsed.values.link;
  const force = parsed.values.force;
  const dryRun = parsed.values["dry-run"];

  /** @type {string[]} */
  const warnings = [];
  /** @type {Array<{ target: string, name: string, action: string }>} */
  const plan = [];
  /** @type {Array<{ target: string, name: string }>} */
  const conflicts = [];

  for (const target of targets) {
    for (const name of names) {
      const destination = path.join(target, name);
      if (existsSync(destination)) {
        if (!force) {
          conflicts.push({ target, name });
          continue;
        }
        plan.push({ target, name, action: link ? "relink" : "overwrite" });
      } else {
        plan.push({ target, name, action: link ? "symlink" : "copy" });
      }
    }
  }

  // A skill installed in two discovery locations resolves unpredictably, so
  // surface the collision instead of letting the agent pick one at random.
  for (const target of targets) {
    for (const name of names) {
      for (const other of discoveryDirs(target, { cwd, home })) {
        if (other === target) continue;
        if (existsSync(path.join(other, name, SKILL_FILE))) {
          warnings.push(
            `"${name}" is also installed in ${display(other, cwd)} — ` +
              "opencode and Claude Code require skill names to be unique. Remove one.",
          );
        }
      }
    }
  }

  if (conflicts.length > 0) {
    for (const { target, name } of conflicts) {
      complain(`${display(path.join(target, name), cwd)} already exists.\n`);
    }
    complain(
      conflicts.length === 1
        ? "Pass --force to overwrite it, or --link to replace it with a symlink.\n"
        : "Pass --force to overwrite them.\n",
    );
    return 1;
  }

  if (dryRun) {
    say("Would install:\n");
    for (const item of plan) {
      say(`  ${item.action.padEnd(9)} ${display(path.join(item.target, item.name), cwd)}\n`);
    }
    say("\nRun without --dry-run to write these.\n");
    return 0;
  }

  for (const item of plan) {
    const destination = path.join(item.target, item.name);
    await mkdir(item.target, { recursive: true });
    await rm(destination, { recursive: true, force: true });
    if (link) {
      await symlink(path.join(skillsDir, item.name), destination, "dir");
    } else {
      await copyTree(path.join(skillsDir, item.name), destination);
    }
    say(`${item.action === "copy" ? "Installed" : item.action === "symlink" ? "Linked" : "Updated"} ${display(destination, cwd)}\n`);
  }

  if (plan.length === 0) {
    say("Nothing to install.\n");
    return 0;
  }

  for (const warning of [...new Set(warnings)]) say(`\nwarning: ${warning}\n`);

  say("\nNext steps:\n");
  say(`  1. Restart ${describeTargets(targets)} — skills load at startup, they are not hot-reloaded.\n`);
  if (link) {
    say(
      "  2. Do not commit these symlinks: git stores the absolute path\n" +
        `     ${display(path.join(skillsDir, names[0]), cwd)}\n` +
        "     and it will be dead on every other machine. Add this to .gitignore:\n" +
        `       ${display(path.relative(cwd, targets[0]) || targets[0], cwd)}/\n` +
        "     Or reinstall with a copy (drop --link) and commit that instead.\n",
    );
  } else {
    say(`  2. Commit ${display(path.relative(cwd, targets[0]) || targets[0], cwd)}/ so teammates get the same skills.\n`);
  }
  say(
    `  3. Ask for the thing, e.g. "review this PR before I merge".\n`,
  );
  return 0;
}

/**
 * @param {string} dir
 * @returns {Promise<string[]>} sorted folder names containing a SKILL.md
 */
async function discover(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const names = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    if (entry.name === "node_modules") continue;
    if (!existsSync(path.join(dir, entry.name, SKILL_FILE))) continue;
    names.push(entry.name);
  }
  return names.sort();
}

/**
 * @param {{ values: Record<string, unknown>, cwd: string, home: string }}
 * @returns {{ targets: string[], error: string | null }}
 */
function resolveTargets({ values, cwd, home }) {
  if (values.target) return { targets: [path.resolve(cwd, String(values.target))], error: null };

  const scope = values.scope ?? "project";
  if (scope !== "project" && scope !== "global") {
    return { targets: [], error: `Invalid --scope "${scope}". Use project or global.` };
  }

  const requested = String(values.agent ?? "opencode")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const keys = requested.includes("all") ? Object.keys(AGENTS) : requested;

  const unknown = keys.filter((key) => !AGENTS[key]);
  if (unknown.length > 0) {
    return {
      targets: [],
      error: `Unknown --agent: ${unknown.join(", ")}. Use opencode, claude, codex, or all.`,
    };
  }
  if (keys.length === 0) return { targets: [], error: "Missing --agent." };

  /** @type {string[]} */
  const targets = [];
  for (const key of keys) {
    for (const relative of AGENTS[key][scope]) {
      const absolute = scope === "global" ? path.join(home, relative) : path.resolve(cwd, relative);
      if (!targets.includes(absolute)) targets.push(absolute);
    }
  }
  return { targets, error: null };
}

/**
 * Every skills directory the agent reads for this scope, so a name installed in
 * two places can be reported.
 *
 * @param {string} target
 * @param {{ cwd: string, home: string }} context
 * @returns {string[]}
 */
function discoveryDirs(target, { cwd, home }) {
  const project = new Set();
  const global = new Set();
  for (const agent of Object.values(AGENTS)) {
    for (const relative of [...agent.project, ...agent.reads]) {
      project.add(path.resolve(cwd, relative));
    }
    for (const relative of agent.global) {
      global.add(path.join(home, relative));
    }
  }
  return target.startsWith(home) ? [...global] : [...project];
}

/**
 * @param {string} source
 * @param {string} destination
 */
async function copyTree(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, to);
    } else if (entry.isSymbolicLink()) {
      await symlink(await readlink(from), to);
    } else {
      await copyFile(from, to);
      const info = await lstat(from);
      await chmod(to, info.mode & 0o777);
    }
  }
}

/**
 * @param {string[]} names
 * @param {{ cwd: string, home: string, scope?: string }} context
 */
async function renderList(names, { cwd, home, scope }) {
  const rows = [];
  for (const dir of discoveryDirs("", { cwd, home })) {
    for (const name of names) {
      const info = await describeInstallation(path.join(dir, name));
      if (info) rows.push(`  ${info.padEnd(22)} ${name.padEnd(30)} ${display(dir, cwd)}`);
    }
  }
  const scopeNote =
    scope && scope !== "project"
      ? ""
      : "\nProject folders are shown. Pass --scope global to list your home directory.\n";
  if (rows.length === 0) {
    return `No library skills installed yet.\nRun: skills-install${scopeNote}`;
  }
  return `Installed library skills:\n${rows.join("\n")}\n${scopeNote}`;
}

/**
 * @param {string} destination
 * @returns {Promise<string | null>}
 */
async function describeInstallation(destination) {
  try {
    const info = await lstat(destination);
    if (info.isSymbolicLink()) return "symlink";
    if (info.isDirectory()) return existsSync(path.join(destination, SKILL_FILE)) ? "copy" : null;
    return null;
  } catch {
    return null;
  }
}

/** @param {string} absolute @param {string} cwd */
function display(absolute, cwd) {
  const relative = path.relative(cwd, absolute);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative === "" ? "." : relative;
  }
  const home = homedir();
  return absolute.startsWith(home) ? `~${absolute.slice(home.length)}` : absolute;
}

/** @param {string[]} targets */
function describeTargets(targets) {
  const labels = new Set(
    targets.map((target) =>
      Object.values(AGENTS).find((agent) =>
        [...agent.project, ...agent.global].some((relative) => target.endsWith(relative)),
      )?.label ?? target,
    ),
  );
  return [...labels].join(" and ");
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`${error?.stack ?? error}\n`);
      process.exitCode = 2;
    },
  );
}
