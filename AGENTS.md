# AGENTS.md

Instructions for AI agents (and humans) working in this repository. This repo is
a **library of skills**, not an application. There is no build step and no runtime
code outside of `scripts/`.

## What this repo is

Each entry under `skills/` is a self-contained skill:

```
skills/<skill-name>/SKILL.md
```

`SKILL.md` is markdown with YAML frontmatter. Agents (opencode, Claude Code,
Codex, …) load the `name` + `description` into context at startup and read the
body only when the description matches the task. That is why the `description` is
the most important line in the whole file.

## Non-negotiable rules

1. **One skill per folder, folder name == `name`.** `skills/my-thing/SKILL.md`
   must declare `name: my-thing`. Never put loose `.md` files in `skills/`.
2. **`description` is mandatory and written in third person.** It must say *what
   the skill does* **and** *when to trigger it*, front-loading the literal words a
   user would type ("review", "pull request", "commit message"). Start with
   "Use when…" or "Use ONLY when…". A skill without a usable description is never
   surfaced to the model and is effectively dead code.
3. **`SKILL.md` filename and casing are exact.** The filename is `SKILL.md`.
4. **The body is an instruction set, not documentation.** Write imperatives
   directed at the agent ("Read X, then Y", "Never do Z"). No second-person
   marketing tone, no "In this skill we will…".
5. **Keep the body under ~500 lines.** If a skill grows past that, move detail
   into `skills/<name>/references/*.md` and link to it. Progressive disclosure
   only works if the file stays small.
6. **No secrets, no personal paths, no absolute paths.** Skills must run in any
   checkout, anywhere.
7. **Run `npm run check` before you finish.** It validates every skill and runs
   the parser tests. Do not open a PR with a failing check.

## Anatomy of a good skill

```
---
name: <folder-name>                 # required, lowercase-hyphen, <=64 chars
description: Use when <trigger>.    # required, third person, keywords first
license: MIT                        # optional
compatibility: opencode, claude-code # optional, tool names it needs
metadata:                           # optional, string -> string only
  author: your-handle
  version: 1.0.0
---

# Title

One-paragraph statement of what this skill accomplishes and when.

## When to use this
## Inputs                        # what the agent needs before starting
## Procedure                    # numbered, unambiguous steps
## Output format                # exact shape of the deliverable
## Guardrails                   # what the agent must never do
## Examples
```

Structure above is a convention, not a schema — deviate when the task warrants
it, but keep *Inputs*, *Procedure*, *Guardrails* and *Output format* in some form.
An agent should be able to execute the skill by reading it once.

## Adding a skill

```bash
npm run new -- my-skill --description "Use when ... " --author "@you"
# or, without the npm package:
node scripts/new-skill.mjs my-skill
```

The scaffolder creates `skills/my-skill/SKILL.md` from `templates/skill-template/`
and any extra files you pass (`references/`, `scripts/`).

Then: validate, commit, and add the skill to the table in `README.md`. CI fails if
a skill exists on disk but is not in the README index, so do not skip it.

## Repository layout

| Path                      | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `skills/<name>/`          | Installable skills. The product of this repo.              |
| `templates/skill-template/` | Starting point for new skills. Not itself a skill.        |
| `scripts/validate.mjs`    | Lints every `SKILL.md`. `npm run validate`.               |
| `scripts/new-skill.mjs`   | Scaffolds a new skill. `npm run new -- <name>`.            |
| `scripts/lib/`            | Zero-dependency frontmatter parser + rule engine.          |
| `scripts/test/`           | `node --test` suite for the parser and rules.              |
| `.github/workflows/ci.yml`| Runs `npm run check` on every push and PR.                 |

## Frontmatter reference

Supported top-level keys (unknown keys are reported as a warning):

| Key             | Type              | Required | Notes                                            |
| --------------- | ----------------- | -------- | ------------------------------------------------ |
| `name`          | string            | yes      | `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 64 chars, == folder |
| `description`   | string            | yes      | ≤ 1024 chars, third person, keywords first        |
| `license`       | string            | no       | SPDX identifier preferred                         |
| `compatibility` | string or list    | no       | e.g. `opencode, claude-code, codex`               |
| `metadata`      | map of strings    | no       | Values must be strings, not nested maps           |

The parser intentionally supports a small YAML subset: scalars, quoted strings,
one level of nested maps, and block lists. Anchors, multi-line scalars, and
flow mappings are not supported — keep frontmatter flat.

## Testing guidance

- The validator is the test suite for skill quality; add a real skill and check it
  passes before inventing new checks.
- Parser behaviour is covered in `scripts/test/frontmatter.test.mjs`. If you
  change the parser, extend those tests.
- There are no unit tests for skill *content* — that is what the LLM is for.
