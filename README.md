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

There are three ways to make these skills available to your agent. The npm package
is not yet published to the registry; use a git clone or a local `file:`/tarball
install until v1.0.1 or later is on npm.

### Option 1: Clone + install helper (recommended)

The repo ships `skills-install`, which copies whole skill folders (including any
`references/` assets) to the right location for your agent.

```bash
git clone https://github.com/mr-dave-towers/skills.git ~/github/skills
cd /path/to/your/repo

# Install all skills for opencode, project scope (default)
node ~/github/skills/scripts/install-skills.mjs

# Or use a symlink (local only, never commit symlinks)
node ~/github/skills/scripts/install-skills.mjs --link

# Install a subset for Claude Code, globally
node ~/github/skills/scripts/install-skills.mjs --agent claude --scope global code-review frontend-design
```

Project scope writes to `.opencode/`, `.claude/`, or `.agents/` in the current
repo. Global scope writes to `~/.config/opencode/`, `~/.claude/`, or
`~/.agents/`. Pass `--list` to see what is installed and where.

> [!WARNING]
> **Never commit symlinks.** When you pass `--link`, git records the absolute
> target path (e.g. `/home/you/github/skills/skills/code-review`) and that link
> will be broken for every other machine. Either commit the copied folders
> (drop `--link`) or add the destination folder (e.g. `.opencode/skills/`) to
> your `.gitignore` if it's local-only.

> [!NOTE]
> **Copy the whole folder.** `code-review`, `frontend-design`, and
> `wordpress-classic-theme` ship a `references/` directory referenced from
> `SKILL.md`. Only copying `SKILL.md` will break the skill.

> [!IMPORTANT]
> **Skill names must be unique.** If the same skill name exists in multiple
> discovery locations (global, project, or any `skills.paths`), the agent may load
> an unexpected version. The `skills-install` helper warns if it detects a name
> collision when installing.

### Option 2: Point opencode to the library (zero files in your repo)

If you only care about opencode, you can reference the cloned library via
`skills.paths` in your config. This keeps your repo clean and loads every skill
in that folder.

```jsonc
// opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "skills": {
    "paths": ["/home/you/github/skills/skills"]
  }
}
```

`skills.paths` is an array of absolute paths to directories containing skill
folders (`skills/<name>/SKILL.md`). opencode discovers them at startup. This is
only supported by opencode currently; other agents require folders under their
standard `skills/` directories (Option 1 or Option 3).

### Option 3: Manually copy or symlink

Symlink example (local-only):

```bash
mkdir -p .opencode/skills
ln -s ~/github/skills/skills/code-review .opencode/skills/code-review
```

Copy example (portable, can commit):

```bash
mkdir -p .opencode/skills
cp -r ~/github/skills/skills/code-review .opencode/skills/
git add .opencode/skills && git commit -m "chore: add agent skills"
```

Repeat for Claude Code (`.claude/skills/` or `~/.claude/skills/`) and Codex
(`.agents/skills/` or `~/.agents/skills/`). See `node ~/github/skills/scripts/install-skills.mjs --help`
for exact locations per agent and scope.

### npm (package not published yet)

The `skills` package is prepared for publishing but not yet
available on npm. Once published, you'll be able to run:

```bash
npx --package=david-torres-skills skills-install
npx --package=david-torres-skills skills-validate --strict
npx --package=david-torres-skills skills-new my-skill --description "Use when …"
```

Until then, use the local clone methods above.

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
| `node scripts/install-skills.mjs` | Install skills to agent dirs (copy/symlink, per agent and scope). See `--help`. |
| `npm test` | `node --test` suite for the parser, rules, scaffolder, and installer. |
| `npm run check` | `validate:strict` + `test`. Run this before every PR. |

The scripts have zero runtime dependencies (Node ≥ 20, ESM).

## Programmatic access

```js
import { listSkills, getSkill } from "david-torres-skills";

const skills = await listSkills();
const review = await getSkill("code-review", { includeFiles: true });
```

## License

[MIT](./LICENSE) © David Torres
