# skills

A versioned, reusable library of **AI agent skills** — the `SKILL.md` files that
opencode, Claude Code, Codex, and other agents load into context on demand.

Skills are not prompts you paste. Each one is a small, self-describing folder: a
frontmatter block that is *always* in context, and a body that is read only when
the description matches the task. That makes the description the highest-leverage
line in the file, and it is why this library is curated rather than accumulated.

## Skills

| Skill | Use it when | Reference |
| ----- | ----------- | --------- |
| [code-review](./skills/code-review/SKILL.md) | Reviewing a PR, diff, or branch before merge | [language checklists](./skills/code-review/references/language-checklists.md) |
| [commit-and-pr-descriptions](./skills/commit-and-pr-descriptions/SKILL.md) | Writing commit messages, PR titles/bodies, or changelog entries from real work | — |

### Frontend design

| Skill | Use it when | Reference |
| ----- | ----------- | --------- |
| [frontend-design](./skills/frontend-design/SKILL.md) | Building a new page, section, or screen from a brief, mockup, or screenshot | [craft heuristics](./skills/frontend-design/references/craft-heuristics.md) |
| [ui-polish](./skills/ui-polish/SKILL.md) | Auditing or refining existing UI — spacing, hierarchy, alignment, states, contrast | — |
| [design-tokens](./skills/design-tokens/SKILL.md) | Setting up, naming, or auditing design tokens and scales in CSS, Tailwind, or `theme.json` | — |
| [css-architecture](./skills/css-architecture/SKILL.md) | Organising or reducing CSS — cascade layers, dead rules, specificity, bundle budget | — |
| [component-library](./skills/component-library/SKILL.md) | Designing a reusable component's API — props, slots, states, a11y contract, versioning | — |

### WordPress

| Skill | Use it when | Reference |
| ----- | ----------- | --------- |
| [wordpress-block-theme](./skills/wordpress-block-theme/SKILL.md) | Building or debugging a full-site-editing theme — `theme.json`, templates, patterns, custom blocks | — |
| [wordpress-classic-theme](./skills/wordpress-classic-theme/SKILL.md) | Working on a classic PHP theme — template hierarchy, the Loop, enqueueing, theme supports, CPTs | [hierarchy and escaping](./skills/wordpress-classic-theme/references/hierarchy-and-escaping.md) |
| [wordpress-acf](./skills/wordpress-acf/SKILL.md) | Building a content model with Advanced Custom Fields — field groups, repeaters, relationships | — |
| [wordpress-plugin-development](./skills/wordpress-plugin-development/SKILL.md) | Writing a WordPress plugin — admin pages, settings, REST, AJAX, cron, nonces, uninstall | — |

Each row is a folder under [`skills/`](./skills). Every `SKILL.md` is standalone
and can be copied into any other project.

## Install

### opencode

Point opencode at this folder — it scans recursively for `**/SKILL.md`:

```jsonc
// opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "skills": {
    "paths": ["/absolute/path/to/skills/skills"]
  }
}
```

Or symlink the ones you want, so opencode's default discovery picks them up:

```bash
mkdir -p .opencode/skills
ln -s /absolute/path/to/skills/skills/code-review .opencode/skills/code-review
```

Restart opencode afterwards — config and skills are read at startup, not hot-reloaded.

### Claude Code

```bash
mkdir -p ~/.claude/skills
ln -s /absolute/path/to/skills/skills/code-review ~/.claude/skills/code-review
```

### Codex / anything else

Copy or symlink `skills/<name>/` into the agent's skills directory, or point its
config at [`skills/`](./skills). The format is the open standard: YAML frontmatter
with `name` + `description`, instructions in the body.

### npx

The package ships two bins. `npx` resolves package names, not bin names, so
pass the package explicitly:

```bash
npx --package=@mr-dave-towers/skills skills-validate --strict
npx --package=@mr-dave-towers/skills skills-new my-skill --description "Use when …"
```

From a clone, use `npm run check` and `npm run new -- <name>` instead.

## Use a skill

Ask for the thing the description advertises and the agent will load the right
skill:

```text
review this PR before I merge
write a commit message for what's staged
summarise these changes for the release notes
```

## Contributing a skill

```bash
git clone https://github.com/mr-dave-towers/skills.git && cd skills
npm run new -- my-skill --description "Use when … " --author "@you"
npm run check
```

Then add a row to the table above. The rules an agent must follow when editing
this repo live in [AGENTS.md](./AGENTS.md); the human-facing version is
[CONTRIBUTING.md](./CONTRIBUTING.md).

## Tooling

| Command | What it does |
| ------- | ------------ |
| `npm run validate` | Lint every `SKILL.md`. Warnings do not fail. |
| `npm run validate:strict` | Same, with warnings as failures. What CI runs. |
| `npm run new -- <name>` | Scaffold a skill from [`templates/skill-template/`](./templates/skill-template). |
| `npm test` | `node --test` suite for the parser and rule engine. |
| `npm run check` | `validate:strict` + `test`. Run this before every PR. |

The scripts have zero runtime dependencies (Node ≥ 20, ESM).

## Programmatic access

```js
import { listSkills, getSkill } from "@mr-dave-towers/skills";

const skills = await listSkills();
const review = await getSkill("code-review", { includeFiles: true });
```

## License

[MIT](./LICENSE) © David Torres
