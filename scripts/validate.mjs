#!/usr/bin/env node
/**
 * Lint every skill in `skills/`.
 *
 *   skills-validate              # warnings are reported but do not fail
 *   skills-validate --strict     # warnings fail too (used by CI)
 *   skills-validate --json       # machine-readable output
 *   skills-validate code-review  # validate a single skill folder
 *
 * Exit codes: 0 = clean, 1 = errors (or warnings under --strict), 2 = bad usage.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parseFrontmatter, isPlainObject } from "./lib/frontmatter.mjs";
import { checkSkill } from "./lib/rules.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SKILLS_DIR = path.join(ROOT, "skills");
const README_PATH = path.join(ROOT, "README.md");
const SKILL_FILE = "SKILL.md";

const USAGE = `Usage: skills-validate [options] [skill-folder ...]

Options:
  --strict        Treat warnings as failures.
  --json          Print a JSON report instead of human-readable text.
  --no-color      Disable ANSI colours.
  -h, --help      Show this help.

Validates every skill under ./skills, or only the named folders.
Exit code 0 when clean, 1 when errors (or warnings with --strict), 2 on bad usage.`;

/** @param {{ argv?: string[] }} [input] */
export async function main(input = {}) {
  const argv = input.argv ?? process.argv.slice(2);

  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        strict: { type: "boolean", default: false },
        json: { type: "boolean", default: false },
        "no-color": { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
      allowPositionals: true,
    });
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${USAGE}\n`);
    return 2;
  }

  if (parsed.values.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  const color = !parsed.values["no-color"] && process.stdout.isTTY && !parsed.values.json;

  if (!existsSync(SKILLS_DIR)) {
    process.stderr.write(`No skills directory at ${SKILLS_DIR}\n`);
    return 2;
  }

  const requested = parsed.positionals;
  let folders;
  try {
    folders = await discoverSkills(requested);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }

  if (folders.length === 0) {
    process.stderr.write(
      requested.length > 0
        ? `No skill folders matched: ${requested.join(", ")}\n`
        : `No skills found in ${path.relative(ROOT, SKILLS_DIR) || "skills"}/\n`,
    );
    return 2;
  }

  const readme = await readReadme();
  const reports = [];

  for (const folder of folders) {
    reports.push(await validateFolder(folder, { readme, strict: parsed.values.strict }));
  }

  if (parsed.values.json) {
    process.stdout.write(`${JSON.stringify(buildJsonReport(reports, parsed.values.strict), null, 2)}\n`);
  } else {
    process.stdout.write(renderText(reports, { color, strict: parsed.values.strict }));
  }

  const failed = reports.some(
    (report) => report.errors.length > 0 || (parsed.values.strict && report.warnings.length > 0),
  );
  return failed ? 1 : 0;
}

/**
 * @param {string[]} requested
 * @returns {Promise<string[]>} absolute folder paths
 */
async function discoverSkills(requested) {
  if (requested.length > 0) {
    return requested.map((name) => {
      const candidate = path.isAbsolute(name) ? name : path.join(SKILLS_DIR, name);
      if (!existsSync(candidate)) throw new Error(`Skill folder not found: ${candidate}`);
      return candidate;
    });
  }

  const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("_"))
    .filter((entry) => !entry.name.startsWith("node_modules"))
    .map((entry) => path.join(SKILLS_DIR, entry.name))
    .sort();
}

/** @returns {Promise<string>} */
async function readReadme() {
  try {
    return await readFile(README_PATH, "utf8");
  } catch {
    return "";
  }
}

/**
 * @param {string[]} folders absolute folder paths
 * @param {{ readme?: string, strict?: boolean }} [options]
 */
export async function validateFolders(folders, options = {}) {
  const readme = options.readme ?? (await readReadme());
  const strict = options.strict ?? false;
  const reports = [];
  for (const folder of folders) {
    reports.push(await validateFolder(folder, { readme, strict }));
  }
  return reports;
}

/**
 * @param {string} folder
 * @param {{ readme: string, strict: boolean }} options
 */
export async function validateFolder(folder, { readme, strict }) {
  const name = path.basename(folder);
  const errors = [];
  const warnings = [];
  const referencedFiles = [];

  const skillPath = path.join(folder, SKILL_FILE);
  if (!existsSync(skillPath)) {
    errors.push({
      severity: "error",
      message: `Missing ${SKILL_FILE} in ${path.relative(ROOT, folder)}/ (filename is case-sensitive).`,
      line: null,
    });
    return { folder: name, path: path.relative(ROOT, skillPath), errors, warnings, referencedFiles, data: {} };
  }

  // Catch `skill.md` / `Skill.md` sitting next to the real file.
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (entry.isFile() && entry.name !== SKILL_FILE && entry.name.toLowerCase() === "skill.md") {
      errors.push({
        severity: "error",
        message: `Found "${entry.name}" alongside ${SKILL_FILE}. Filename must be exactly ${SKILL_FILE}.`,
        line: null,
      });
    }
  }

  const source = await readFile(skillPath, "utf8");
  const parsed = parseFrontmatter(source, {
    filename: path.relative(ROOT, skillPath),
  });
  errors.push(...parsed.errors);

  if (isPlainObject(parsed.data)) {
    const report = checkSkill({
      folder: name,
      data: parsed.data,
      body: parsed.body,
      bodyStartLine: parsed.bodyStartLine,
    });
    errors.push(...report.errors);
    warnings.push(...report.warnings);
    referencedFiles.push(...report.referencedFiles);

    for (const reference of report.referencedFiles) {
      const target = path.join(folder, reference);
      try {
        const info = await stat(target);
        if (!info.isFile()) {
          warnings.push({
            severity: "warning",
            message: `Referenced path "${reference}" is not a file.`,
            line: null,
          });
        }
      } catch {
        errors.push({
          severity: "error",
          message:
            `Referenced file "${reference}" does not exist in ${path.relative(ROOT, folder)}/. ` +
            "Fix the path or add the file (it must be relative to the skill folder).",
          line: null,
        });
      }
    }
  }

  if (readme && !readmeMentions(readme, name)) {
    const message =
      `Skill "${name}" is not listed in README.md. ` +
      "Add a row to the skills table so the index stays complete.";
    if (strict) errors.push({ severity: "error", message, line: null });
    else warnings.push({ severity: "warning", message, line: null });
  }

  return {
    folder: name,
    path: path.relative(ROOT, skillPath),
    errors,
    warnings,
    referencedFiles,
    data: parsed.data,
  };
}

/** A skill counts as indexed if the README links to its folder or its SKILL.md. */
function readmeMentions(readme, name) {
  const patterns = [
    new RegExp(`skills/${escapeRe(name)}(?:/|\\b)`),
    new RegExp(`\\b${escapeRe(name)}\\b`),
  ];
  return patterns.some((pattern) => pattern.test(readme));
}

function escapeRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** @param {any[]} reports */
function buildJsonReport(reports, strict) {
  return {
    ok: reports.every(
      (report) => report.errors.length === 0 && !(strict && report.warnings.length > 0),
    ),
    strict,
    skills: reports.map((report) => ({
      folder: report.folder,
      path: report.path,
      name: report.data?.name ?? null,
      description: report.data?.description ?? null,
      errors: report.errors,
      warnings: report.warnings,
      referencedFiles: report.referencedFiles,
    })),
    totals: {
      skills: reports.length,
      errors: reports.reduce((sum, report) => sum + report.errors.length, 0),
      warnings: reports.reduce((sum, report) => sum + report.warnings.length, 0),
    },
  };
}

const COLOR = {
  reset: "\u001b[0m",
  red: "\u001b[31m",
  yellow: "\u001b[33m",
  green: "\u001b[32m",
  dim: "\u001b[2m",
  bold: "\u001b[1m",
};

/** @param {any[]} reports */
export function renderText(reports, { color = false, strict = false } = {}) {
  const paint = (text, key) => (color ? `${COLOR[key]}${text}${COLOR.reset}` : text);
  const out = [];
  let errors = 0;
  let warnings = 0;

  for (const report of reports) {
    errors += report.errors.length;
    warnings += report.warnings.length;
    const clean = report.errors.length === 0 && report.warnings.length === 0;

    if (clean) {
      out.push(`${paint("PASS", "green")} ${paint(report.folder, "bold")} ${paint(report.path, "dim")}`);
      continue;
    }

    out.push(`${paint("FAIL", "red")} ${paint(report.folder, "bold")} ${paint(report.path, "dim")}`);
    for (const item of report.errors) out.push(`  ${paint("error", "red")}   ${item.message}`);
    for (const item of report.warnings) out.push(`  ${paint("warn ", "yellow")}  ${item.message}`);
  }

  out.push("");
  out.push(
    `${reports.length} skill${reports.length === 1 ? "" : "s"} checked, ` +
      `${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}` +
      `${strict ? paint(" (strict)", "dim") : ""}`,
  );

  if (errors > 0) out.push(paint("Errors must be fixed.", "red"));
  else if (strict && warnings > 0) out.push(paint("Strict mode: warnings are failures.", "yellow"));
  else out.push(paint("All skills are valid.", "green"));

  return `${out.join("\n")}\n`;
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
