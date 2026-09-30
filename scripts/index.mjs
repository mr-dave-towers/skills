/**
 * Programmatic entry point for the skills library.
 *
 *   import { listSkills, getSkill } from "@mr-dave-towers/skills";
 *
 * Also the `exports["."]` target, so `node -e "import('@mr-dave-towers/skills')"`
 * and bundlers can reach the same helpers.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseFrontmatter } from "./lib/frontmatter.mjs";
import { checkSkill, LIMITS } from "./lib/rules.mjs";

export { parseFrontmatter } from "./lib/frontmatter.mjs";
export { checkSkill, extractReferencedFiles, LIMITS } from "./lib/rules.mjs";
export { validateFolder, validateFolders, renderText, main as validate } from "./validate.mjs";

export const SKILLS_DIR = path.resolve(fileURLToPath(new URL("../skills", import.meta.url)));

/**
 * List every skill's frontmatter without reading the bodies into memory beyond
 * what the parse requires. Useful for building a router or a TUI picker.
 *
 * @param {{ dir?: string }} [options]
 * @returns {Promise<Array<{ name: string, description: string, folder: string, path: string, license?: string, compatibility?: unknown, metadata?: Record<string, string> }>>}
 */
export async function listSkills(options = {}) {
  const dir = options.dir ?? SKILLS_DIR;
  const entries = await readdir(dir, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();

  const skills = [];
  for (const folder of folders) {
    const skill = await getSkill(folder, { dir });
    if (skill) skills.push(skill);
  }
  return skills;
}

/**
 * Read one skill, returning its frontmatter, body, and any bundled files.
 *
 * @param {string} name folder name, e.g. "code-review"
 * @param {{ dir?: string, includeFiles?: boolean }} [options]
 */
export async function getSkill(name, options = {}) {
  const dir = options.dir ?? SKILLS_DIR;
  const folder = path.join(dir, name);
  const file = path.join(folder, "SKILL.md");

  let source;
  try {
    source = await readFile(file, "utf8");
  } catch {
    return null;
  }

  const parsed = parseFrontmatter(source, { filename: `skills/${name}/SKILL.md` });
  const report = checkSkill({
    folder: name,
    data: parsed.data,
    body: parsed.body,
    bodyStartLine: parsed.bodyStartLine,
  });

  /** @type {Record<string, string>} */
  const files = {};
  if (options.includeFiles) {
    for (const reference of report.referencedFiles) {
      try {
        files[reference] = await readFile(path.join(folder, reference), "utf8");
      } catch {
        // Reported by the validator; skip here rather than throwing.
      }
    }
  }

  return {
    name: String(parsed.data.name ?? name),
    folder: name,
    path: `skills/${name}/SKILL.md`,
    description: String(parsed.data.description ?? ""),
    license: parsed.data.license ?? null,
    compatibility: parsed.data.compatibility ?? null,
    metadata: parsed.data.metadata ?? {},
    body: parsed.body.replace(/^\n+/, ""),
    files,
    valid: report.errors.length === 0,
    errors: report.errors,
    warnings: report.warnings,
  };
}
