# Contributing

Thanks for adding skills. This repo has one product: high-quality `SKILL.md`
files. Read [AGENTS.md](./AGENTS.md) first — it is the spec.

## Quick start

```bash
git clone https://github.com/mr-dave-towers/skills.git
cd skills
npm install          # optional, there are zero runtime dependencies
npm run new -- my-skill --description "Use when ..." --author "@you"
```

Then edit `skills/my-skill/SKILL.md`, register the skill in the
[README](./README.md#skills) table, and open a PR.

## Before you open a PR

```bash
npm run check     # validate:strict + unit tests
```

`npm run check` fails when:

- a skill is missing `SKILL.md`, or the file is misnamed or mis-cased;
- `name` is absent, malformed, over 64 chars, or does not match the folder;
- `description` is absent, empty, over 1024 chars, or is written in first person;
- the body is empty or absurdly short (under 10 lines);
- a referenced file (`references/…`, `scripts/…`) does not exist;
- a skill exists on disk but is not listed in the README index;
- the parser unit tests fail.

## What makes a good skill

A skill is loaded in two stages. The frontmatter is always in context; the body
only when the description matches. Optimise for that:

- **Front-load the description.** The literal words a user types are the highest
  signal: "review this PR", "write a commit message", "onboard me to this repo".
- **Make the body executable.** Imperatives, numbered, no preamble. An agent
  should be able to follow it top to bottom without improvising.
- **Specify the output shape.** If the deliverable is a diff, a table, or a
  file, show the exact format. Ambiguity produces inconsistent output.
- **Split at ~500 lines.** Put the long tail in `references/` and link to it.
- **Say no.** A `## Guardrails` section is what keeps a skill from being
  misused on adjacent tasks.

## Adding non-markdown files

A skill folder may contain anything the agent needs at runtime:

```
skills/my-skill/
├── SKILL.md
├── references/
│   └── house-style.md
└── scripts/
    └── collect.sh
```

Reference them with **relative** paths (`references/house-style.md`) so the skill
works in any checkout. Never hardcode an absolute path or a path into a personal
home directory; the validator will catch missing references but not portable
ones, so this is on you.

## Commit style

Conventional Commits, scoped by area:

```
feat(code-review): add guardrails for test-only diffs
docs(contributing): document the strict validate rules
fix(validate): treat empty description as an error, not a warning
```

## Adding infrastructure

Scripts live in `scripts/`, stay dependency-free (Node ≥ 20, ESM, `node:util`
only), and come with tests in `scripts/test/`. If you add a rule to
`scripts/lib/rules.mjs`, add a test for it — including the case that must *not*
trigger it.
