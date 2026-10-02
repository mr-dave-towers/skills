#!/usr/bin/env node
/**
 * Scaffold a new skill.
 *
 *   skills-new my-skill --description "Use when reviewing a pull request."
 *   skills-new my-skill --description "…" --references checklist.md --scripts run.sh
 *   npx skills-new my-skill        # prompts for the description when interactive
 *
 * Creates `skills/<name>/SKILL.md` from `templates/skill-template/SKILL.md`,
 * plus any `references/` and `scripts/` stubs requested. Exits non-zero if the
 * destination already exists unless --force is given.
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { LIMITS } from "./lib/rules.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const TEMPLATE_DIR = path.join(ROOT, "templates", "skill-template");
const DEFAULT_SKILLS_DIR = path.join(ROOT, "skills");
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const USAGE = `Usage: skills-new <skill-name> [options]

Options:
  -d, --description <text>   Required. What the skill does and when to trigger it.
                             Start with "Use when…". Prompted for when interactive.
  -a, --author <handle>      Value for metadata.author (e.g. "@you").
  -l, --license <id>         SPDX identifier. Default: MIT.
  -c, --compatibility <list> Comma-separated tool names. Omit for portability.
  -r, --references <files>   Comma-separated files to create under references/.
  -s, --scripts <files>      Comma-separated files to create under scripts/.
  --dir <path>               Target skills directory. Default: ./skills
  --from <path>              Template directory. Default: templates/skill-template
  --force                    Overwrite an existing skill.
  --no-validate              Skip the post-create validation run.
  --dry-run                  Print what would be created, then exit.
  -h, --help                 Show this help.`;

/**
 * @param {{
 *   argv?: string[],
 *   stdout?: { write(chunk: string): unknown },
 *   stderr?: { write(chunk: string): unknown },
 * }} [input]
 * @returns {Promise<number>} the process exit code
 */
export async function main(input = {}) {
  const argv = input.argv ?? process.argv.slice(2);
  const out = input.stdout ?? process.stdout;
  const err = input.stderr ?? process.stderr;
  const say = (text) => out.write(text);
  const complain = (text) => err.write(text);

  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        description: { type: "string", short: "d" },
        author: { type: "string", short: "a" },
        license: { type: "string", short: "l" },
        compatibility: { type: "string", short: "c" },
        references: { type: "string", short: "r" },
        scripts: { type: "string", short: "s" },
        dir: { type: "string" },
        from: { type: "string" },
        force: { type: "boolean", default: false },
        "no-validate": { type: "boolean", default: false },
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

  const [name, ...extra] = parsed.positionals;
  if (!name) {
    complain(`Missing <skill-name>.\n\n${USAGE}\n`);
    return 2;
  }
  if (extra.length > 0) {
    complain(`Unexpected extra arguments: ${extra.join(" ")}\n`);
    return 2;
  }
  if (!NAME_RE.test(name)) {
    complain(
      `Invalid skill name "${name}".\n` +
        "Use lowercase letters, digits and single hyphens, e.g. `code-review`.\n",
    );
    return 2;
  }
  if (name.length > LIMITS.NAME_MAX) {
    complain(`Skill name is ${name.length} chars; the maximum is ${LIMITS.NAME_MAX}.\n`);
    return 2;
  }

  let description = parsed.values.description;
  if (!description) {
    if (process.stdin.isTTY) description = await prompt("Description (start with 'Use when'): ");
    if (!description) {
      complain(
        "Missing --description.\n" +
          "The description is the only part of a skill that is always in context; " +
          "without it the skill will never be triggered.\n\n" +
          `${USAGE}\n`,
      );
      return 2;
    }
  }
  description = description.trim();
  if (description.length > LIMITS.DESCRIPTION_MAX) {
    complain(
      `Description is ${description.length} chars; the maximum is ${LIMITS.DESCRIPTION_MAX}.\n`,
    );
    return 2;
  }

  const skillsDir = path.resolve(parsed.values.dir ?? DEFAULT_SKILLS_DIR);
  const templateDir = path.resolve(parsed.values.from ?? TEMPLATE_DIR);
  const targetDir = path.join(skillsDir, name);
  const dryRun = parsed.values["dry-run"];

  if (existsSync(targetDir) && !parsed.values.force) {
    complain(
      `${path.relative(process.cwd(), targetDir)} already exists.\n` +
        "Pick another name, delete the folder, or pass --force.\n",
    );
    return 1;
  }
  if (!existsSync(path.join(templateDir, "SKILL.md"))) {
    complain(`No template at ${path.join(templateDir, "SKILL.md")}\n`);
    return 2;
  }

  const template = await readFile(path.join(templateDir, "SKILL.md"), "utf8");
  const rendered = pruneEmptyKeys(
    renderTemplate(template, {
      name,
      title: toTitle(name),
      description,
      author: parsed.values.author ?? "",
      license: parsed.values.license ?? "MIT",
      compatibility: parsed.values.compatibility ?? "",
    }),
  );

  const files = [
    { relative: "SKILL.md", contents: rendered },
    ...stubs("references", parsed.values.references),
    ...stubs("scripts", parsed.values.scripts),
  ];

  if (dryRun) {
    say(`Would create in ${path.relative(process.cwd(), targetDir)}/:\n`);
    for (const file of files) say(`  ${file.relative}\n`);
    say("\nRun without --dry-run to write these files.\n");
    return 0;
  }

  await mkdir(targetDir, { recursive: true });
  for (const file of files) {
    const destination = path.join(targetDir, file.relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.contents, { flag: parsed.values.force ? "w" : "wx" });
  }

  const written = files.map((file) => path.relative(process.cwd(), path.join(targetDir, file.relative)));
  say(`Created ${written.join(", ")}\n`);

  if (!parsed.values["no-validate"]) {
    const { validateFolders, renderText } = await import("./validate.mjs");
    const reports = await validateFolders([targetDir], { strict: false });
    say("\n");
    say(renderText(reports, { color: false, strict: false }));
    if (reports.some((report) => report.errors.length > 0)) {
      complain(
        "\nThe new skill has validation errors. Fix them before committing:\n" +
          "  node scripts/validate.mjs " +
          name +
          "\n",
      );
      return 1;
    }
  }

  say(
    "\nNext steps:\n" +
      `  1. Replace the placeholder sections in ${path.relative(process.cwd(), path.join(targetDir, "SKILL.md"))}\n` +
      "  2. Add the skill to the table in README.md\n" +
      "  3. Run `npm run check` and commit\n",
  );
  return 0;
}

/**
 * @param {string} template
 * @param {Record<string, string>} values
 */
function renderTemplate(template, values) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) =>
    Object.hasOwn(values, key) ? values[key] : match,
  );
}

/**
 * Drop optional keys whose placeholder rendered empty, so a skill created
 * without `--compatibility` or `--author` does not ship a dangling
 * `compatibility:` or `author: ""` line.
 *
 * @param {string} rendered
 */
function pruneEmptyKeys(rendered) {
  return rendered
    .replace(/^compatibility:[ \t]*\n/m, "")
    .replace(/^[ \t]+author:[ \t]*""[ \t]*\n/m, "")
    .replace(/^\n{3,}/gm, "\n\n");
}

/**
 * @param {string} subdir
 * @param {string | undefined} value
 */
function stubs(subdir, value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const relative = `${subdir}/${item}`;
      const contents =
        subdir === "scripts" && /\.(?:sh|bash)$/.test(item)
          ? `#!/usr/bin/env bash\n# TODO: implement. Reference it from SKILL.md as \`${relative}\`.\nset -euo pipefail\n`
          : `# ${item}\n\nTODO: replace this with the reference material the skill needs.\n`;
      return { relative, contents, executable: subdir === "scripts" };
    });
}

/** @param {string} name */
function toTitle(name) {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function prompt(question) {
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
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
