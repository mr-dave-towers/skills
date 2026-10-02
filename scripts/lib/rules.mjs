/**
 * Rule engine for SKILL.md content. Pure functions only — filesystem access
 * lives in `scripts/validate.mjs` so these rules are trivially testable.
 */

export const LIMITS = {
  NAME_MAX: 64,
  DESCRIPTION_MAX: 1024,
  DESCRIPTION_MIN: 40,
  BODY_MIN_LINES: 10,
  BODY_MAX_LINES: 500,
};

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const KNOWN_KEYS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
]);

const TRIGGER_RE =
  /^\s*(use (?:only )?when|use this when|use for|use if|trigger(?:ed)? (?:when|on|by)|invoke (?:when|on)|apply (?:when|to)|call (?:when|on))/i;

const FIRST_PERSON_RE = /^\s*(i|we|my|our)\b/i;
const FIRST_PERSON_CLAIM_RE = /\b(?:i|we) (?:help|will|can|am|are|handle|suggest|provide|write|review)\b/i;

const SECRET_RE =
  /\b(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|gho_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----)/;

const ABSOLUTE_PATH_RE = /(?:^|[\s"'`(])(?:\/home\/[A-Za-z0-9._-]+\/|\/Users\/[A-Za-z0-9._-]+\/|\/root\/|[A-Za-z]:\\)/;

/**
 * @typedef {{ severity: "error" | "warning", message: string, line: number|null }} Diagnostic
 * @typedef {{
 *   folder: string,
 *   errors: Diagnostic[],
 *   warnings: Diagnostic[],
 *   referencedFiles: string[],
 *   data: Record<string, unknown>,
 * }} SkillReport
 */

/**
 * @param {{ folder: string, data: Record<string, unknown>, body: string, bodyStartLine?: number }} input
 * @returns {SkillReport}
 */
export function checkSkill(input) {
  const { folder, data, body, bodyStartLine = 1 } = input;
  /** @type {Diagnostic[]} */
  const errors = [];
  /** @type {Diagnostic[]} */
  const warnings = [];

  const error = (message, line = null) => errors.push({ severity: "error", message, line });
  const warn = (message, line = null) => warnings.push({ severity: "warning", message, line });

  checkFrontmatterKeys(data, warn);
  checkName(data, folder, error, warn);
  checkDescription(data, error, warn);
  checkOptionalKeys(data, warn);

  const { referencedFiles } = checkBody(body, bodyStartLine, error, warn);

  return { folder, errors, warnings, referencedFiles, data };
}

function checkFrontmatterKeys(data, warn) {
  for (const key of Object.keys(data)) {
    if (!KNOWN_KEYS.has(key)) {
      warn(
        `Unknown frontmatter key "${key}". Known keys: ${[...KNOWN_KEYS].join(", ")}. ` +
          "Unknown keys are ignored by agents, so this is almost always a typo " +
          "(did you mean `compatibility`?) or belongs under `metadata`.",
      );
    }
  }
}

function checkName(data, folder, error, warn) {
  const { name } = data;

  if (name === undefined || name === null) {
    error("Missing `name` in frontmatter. It is required and must match the folder name.");
    return;
  }
  if (typeof name !== "string") {
    error(`\`name\` must be a string, got ${typeof name}. Quote the value: name: "${folder}"`);
    return;
  }
  if (name.length === 0) {
    error("`name` is empty.");
    return;
  }
  if (name.length > LIMITS.NAME_MAX) {
    error(`\`name\` is ${name.length} chars; the maximum is ${LIMITS.NAME_MAX}.`);
  }
  if (!NAME_RE.test(name)) {
    error(
      `\`name\` must be lowercase letters, digits and single hyphens (${name}). ` +
        "Pattern: ^[a-z0-9]+(-[a-z0-9]+)*$",
    );
  }
  if (name !== folder) {
    error(`\`name\` ("${name}") must exactly match the skill folder name ("${folder}").`);
  }
  if (name !== name.toLowerCase()) {
    warn(`\`name\` should be lowercase.`);
  }
}

function checkDescription(data, error, warn) {
  const { description } = data;

  if (description === undefined || description === null) {
    error(
      "Missing `description` in frontmatter. Without it the skill is never surfaced to the model.",
    );
    return;
  }
  if (typeof description !== "string") {
    error(
      `\`description\` must be a string, got ${typeof description}. ` +
        "Quote the value if it contains a colon.",
    );
    return;
  }

  const value = description.trim();
  if (value.length === 0) {
    error("`description` is empty.");
    return;
  }
  if (description.length > LIMITS.DESCRIPTION_MAX) {
    error(
      `\`description\` is ${description.length} chars; the maximum is ${LIMITS.DESCRIPTION_MAX}. ` +
        "Front-loading matters more than length — keep the trigger keywords up front.",
    );
  }
  if (value.length < LIMITS.DESCRIPTION_MIN) {
    warn(
      `\`description\` is only ${value.length} chars. It needs enough text to say what the ` +
        "skill does *and* when to trigger it, or the agent will not know when to load it.",
    );
  }
  if (!TRIGGER_RE.test(value)) {
    warn(
      '`description` should start with a trigger phrase such as "Use when…", ' +
        '"Use ONLY when…" or "Use for…". This is the line the agent routes on.',
    );
  }
  if (FIRST_PERSON_RE.test(value) || FIRST_PERSON_CLAIM_RE.test(value)) {
    warn(
      '`description` is written in first person. Write it in third person: ' +
        '"Use when reviewing a pull request…".',
    );
  }
}

function checkOptionalKeys(data, warn) {
  if ("license" in data && data.license !== null && typeof data.license !== "string") {
    warn(`\`license\` should be a string such as "MIT".`);
  }

  if ("compatibility" in data && data.compatibility !== null) {
    const value = data.compatibility;
    const ok =
      typeof value === "string" ||
      (Array.isArray(value) && value.every((item) => typeof item === "string"));
    if (!ok) {
      warn(
        '`compatibility` must be a string or a list of strings, e.g. "opencode, claude-code".',
      );
    }
  }

  if ("metadata" in data && data.metadata !== null) {
    const value = data.metadata;
    if (typeof value !== "object" || Array.isArray(value)) {
      warn("`metadata` must be a mapping of keys to string values.");
    } else {
      for (const [key, item] of Object.entries(value)) {
        if (typeof item !== "string") {
          warn(
            `\`metadata.${key}\` must be a string, got ${typeof item} (${JSON.stringify(item)}). ` +
              "Quote numeric and boolean values, e.g. `version: \"1.0.0\"`.",
          );
        }
      }
    }
  }
}

function checkBody(body, bodyStartLine, error, warn) {
  const allLines = body.split("\n");
  const lines = allLines;
  const contentLines = lines.filter((line) => line.trim() !== "");

  if (contentLines.length === 0) {
    error("The skill body is empty. After the frontmatter, write the instructions.");
    return { lines, referencedFiles: [] };
  }

  if (contentLines.length < LIMITS.BODY_MIN_LINES) {
    error(
      `The body has only ${contentLines.length} non-empty lines. ` +
        "A skill needs at least inputs, procedure, output format, and guardrails.",
    );
  }
  if (lines.length > LIMITS.BODY_MAX_LINES) {
    warn(
      `The body is ${lines.length} lines; the soft ceiling is ${LIMITS.BODY_MAX_LINES}. ` +
        "Move the long tail into `references/*.md` and link to it.",
    );
  }

  const h1 = lines.filter((line) => /^#\s+\S/.test(line));
  const h2 = lines.filter((line) => /^##\s+\S/.test(line));
  if (h1.length === 0) {
    warn("The body has no `# Title` heading.");
  }
  if (h1.length > 1) {
    warn(`The body has ${h1.length} "#" headings. Keep exactly one.`);
  }
  if (h2.length < 2 && contentLines.length > LIMITS.BODY_MIN_LINES) {
    warn(
      "The body has fewer than two `##` sections. Split inputs, procedure, output, " +
        "and guardrails into sections so the agent can scan it.",
    );
  }

  const secret = SECRET_RE.exec(body);
  if (secret) {
    error(
      `The body contains what looks like a credential (${secret[0].slice(0, 8)}…). ` +
        "Skills must never embed secrets; reference an environment variable instead.",
    );
  }

  const absolute = ABSOLUTE_PATH_RE.exec(body);
  if (absolute) {
    warn(
      `The body references the absolute path "${absolute[0].trim()}". Skills must run in ` +
        "any checkout — use paths relative to the skill folder.",
    );
  }

  return { lines, referencedFiles: extractReferencedFiles(body) };
}

/**
 * Collect the relative files a skill depends on, so the validator can confirm
 * they exist. Two sources, deliberately narrow:
 *
 *   1. Relative markdown links — an explicit "read this file" instruction.
 *   2. Code spans that start with a skill-owned directory (`references/…`,
 *      `scripts/…`, `assets/…`).
 *
 * Bare code spans elsewhere are *not* collected: a review or refactor skill
 * naturally writes `src/auth/session.ts` inside backticks, and those are
 * examples about the user's repo, not files shipped with the skill.
 *
 * @param {string} body
 * @returns {string[]}
 */
export function extractReferencedFiles(body) {
  const SKILL_OWNED = /^(?:references|scripts|assets|templates)\//;
  /** @type {Set<string>} */
  const found = new Set();

  const add = (candidate) => {
    if (!candidate) return;
    let target = candidate.trim();
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return; // http:, mailto:, etc.
    if (target.startsWith("#") || target.startsWith("/")) return;
    target = target.replace(/^\.\//, "");
    target = target.split("#")[0].split("?")[0];
    if (target === "") return;
    if (!/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(target)) return;
    if (!/\.[A-Za-z0-9]+$/.test(target)) return; // only file-like targets
    if (target.includes("..")) return;
    found.add(target);
  };

  for (const match of body.matchAll(/\]\(([^)\s]+)\)/g)) add(match[1]);
  for (const match of body.matchAll(/`([^`\n]+)`/g)) {
    if (SKILL_OWNED.test(match[1].trim())) add(match[1]);
  }

  return [...found].sort();
}
