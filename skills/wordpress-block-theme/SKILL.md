---
name: wordpress-block-theme
description: Use when building, editing, or debugging a WordPress full-site-editing (block) theme — theme.json, templates/*.html, parts, patterns, block.json custom blocks, or the Site Editor. Triggers on "block theme", "FSE", "edit theme.json", "add a template", "block pattern", "custom block", "Site Editor is not showing my change".
license: MIT
compatibility: opencode, claude-code, codex
metadata:
  author: "@mr-dave-towers"
  version: 1.0.0
---

# WordPress Block Theme

Author block themes in the platform's own terms: a design system in `theme.json`,
templates as HTML, and patterns as content. The most common failure in this stack
is editing a template file and seeing no change, because a database copy
overrides it. That is checked first, always.

## When to use this

Use it for a theme with a `templates/` directory and a `theme.json` — scaffolding
a new one, changing global styles, adding a template or pattern, writing a custom
block, or debugging why a Site Editor change is not appearing.

Do not trigger when:

- **The theme has no `templates/` directory.** That is a classic or hybrid
  theme; route to `wordpress-classic-theme`.
- **The work is content fields on posts.** Route to `wordpress-acf`.
- **The work is a plugin.** Route to `wordpress-plugin-development`.
- **A block is being registered by a plugin, not a theme.** A plugin-registered
  block still follows the `block.json` rules here, but the file location, enqueue
  hooks, and uninstall behaviour belong to
  `wordpress-plugin-development`. Use both if the block ships in a plugin.

## Inputs

| Input | Required | How to obtain it |
| ----- | -------- | ---------------- |
| Theme location | yes | Confirm `templates/` and `theme.json` exist. Absence changes the whole answer. |
| WordPress version | yes | `$wp_version` in `wp-includes/version.php`, or `Requires at least` in `style.css`. `theme.json` version 3 needs 6.6+. |
| Target | no | A screen, a global style change, a custom block, a new pattern. |
| Design inputs | no | A brand palette, a type scale, a component to match. Reuse them; do not invent. |
| Database state | no | Whether templates or styles have been customised in the Site Editor. This decides whether a file edit will be visible. |

## Procedure

1. **Confirm the theme type before anything else.** `templates/` plus
   `theme.json` means a block theme. If the theme also has a `functions.php` with
   template hooks, it is hybrid — know which template system is actually serving
   the page.
2. **Read `theme.json` in full.** It is the design system, and every block
   inherits from it. Note `version`, `settings` (what is allowed), `styles` (what
   is the default), the `settings.typography.fontFamilies` and
   `settings.color.palette` shape, and any existing `styles.elements` and
   `styles.blocks` entries. A value set here overrides a per-block value
   everywhere, so it is where most "why is it still that colour" answers live.
3. **Check for database overrides before editing any file.** Templates,
   template parts, and global styles are post types (`wp_template`,
   `wp_template_part`, `wp_global_styles`). If the user has edited them in the
   Site Editor, the file is ignored. Say so explicitly and offer the two real
   options: make the change in the Site Editor, or reset the customised content
   and make it in the file. Never silently edit a file and report success.
4. **Make global design changes in `theme.json`, not in a template.** Presets
   live under `settings`; the defaults that apply to every instance live under
   `styles`. Use `styles.elements` for the base look of a link, button, or
   heading, and `styles.blocks` plus `styles.variants` for per-block and
   per-variant overrides. Hand-editing `wp-block-*` classes in a template
   template is a bug: it is a generated class and it will change.
5. **Write templates as block markup with stable classes.** Use
   `<!-- wp:group {"tagName":"section","className":"hero"} -->` and a semantic
   `tagName` rather than targeting a generated class. Add your own class names to
   `className` and style those. Never rely on `wp-block-columns__inner` or any
   other `__`-separated structural class.
6. **Use layout blocks and `theme.json` presets instead of pixel CSS.** A group
   with `layout` and a `var:preset|spacing|80` reference adapts when the preset
   changes. If a hardcoded value is unavoidable, note it in the report as
   intentional.
7. **Add patterns as files in `patterns/`.** They are portable and version
   controlled, unlike content inserted through the editor. Use `Slug`,
   `Categories`, and `Block Types` front matter, and `Inserter: no` for patterns
   meant only as child patterns. Pattern PHP is available for dynamic parts
   (`<!-- wp:pattern {"slug":"…/…"} -->` plus a `patterns/name.php` returning
   markup), which is the escape hatch when block markup is not enough.
8. **Register custom blocks with `block.json`**, not a deprecated
   `register_block_type` call with inline metadata. Put the schema, supports,
   and script handles in `block.json` and register the folder path. Only reach
   for a `render` callback when the block genuinely needs server-side rendering;
   a static block should be a static save.
9. **Register `theme.json` extensions in PHP only when the value is dynamic.**
   Static design decisions belong in the JSON. Use the `theme_json_*` filters
   (`wp_theme_json_data_theme`, `wp_theme_json_data_default`, and the newer
   `theme_json_*_{$hook}` variants) to add presets conditionally — per post type,
   per template, or from a customizer setting. Reading `theme.json` directly and
   rewriting it in PHP is a maintenance trap.
10. **Verify the actual result.** Check `WP_DEBUG` for notices, confirm the Site
    Editor lists the new template, and check the front end. A `theme.json` syntax
    error is silent in the editor and falls back to core defaults — if styles
    suddenly reset, validate the JSON first.

## The database-override trap

The single most important thing to communicate about block themes. Templates,
parts, patterns, and global styles are editable content stored in the database,
layered over the theme files. The layering:

- Database (Site Editor) wins over the file.
- The file is the default. Editing the file changes what a *reset* looks like.
- Only "reverted" or never-customised templates follow the file.

Practical consequences:

- An edit to a template file may change nothing on a site whose templates were
  customised in the Site Editor. Diagnose before editing.
- A reset is destructive for the user. Never run it without saying what will be
  lost.
- For repeatable changes across sites, the file is the right place. For
  per-site changes, the Site Editor is. Ask which one is meant.

When asked why a file edit did nothing, check for a customised template first,
and only then look at caching.

## File layout

```text
theme-name/
├── style.css              # theme header only; not loaded as a stylesheet
├── theme.json             # design system: settings + styles
├── functions.php          # enqueue, block patterns, filters
├── templates/             # HTML with block markup
│   ├── index.html
│   ├── front-page.html
│   ├── single.html
│   ├── page.html
│   ├── archive.html
│   ├── search.html
│   ├── 404.html
│   └── page-{slug}.html   # one-off page templates
├── parts/
│   ├── header.html
│   └── footer.html
├── patterns/
│   ├── hero.php
│   └── call-to-action.php
└── blocks/
    └── my-block/
        ├── block.json
        ├── index.js
        ├── view.js
        ├── index.css
        └── render.php     # only for dynamic blocks
```

## Common tasks

| Task | Where it goes | Note |
| ---- | ------------- | ---- |
| Brand colour preset | `theme.json` → `settings.color.palette` | Add, do not replace, unless removing is intended |
| Base link colour | `theme.json` → `styles.elements.link.color.text` | |
| Default heading scale | `theme.json` → `styles.typography` + `settings.typography.fontSizes` | Preset must exist before it is referenced |
| Page structure | `templates/*.html` | One file per template; keep them thin |
| Header/footer | `parts/header.html`, `parts/footer.html` | Referenced by `<!-- wp:template-part -->` |
| Reusable block content | `patterns/*.php` | Files are portable; DB patterns are not |
| Conditional design | `functions.php` → `theme_json_*` filters | Never rewrite `theme.json` wholesale |
| Custom block schema | `blocks/*/block.json` | Prefer a static save |
| Editor styles | `functions.php` → `add_editor_style()` | Applies to block editor, not site editor |
| One-off page template | `templates/page-{slug}.html` | Also declare in `customTemplates` for a label |

## Output format

```markdown
## Changes

<files touched> · <n> files

**Global styles** (`theme.json`)
| Path | Change | Effect |
| ---- | ------ | ------ |
| `settings.color.palette` | +`brand-600` | New preset, available to every block |
| `styles.elements.link` | `color.text` → `--brand-600` | Links in every template |

**Templates**
| File | Change |
| ---- | ------ |
| theme single template | Hero group with `layout` and `var:preset\|spacing\|60` |

**Database overrides**
<Whether any affected template is customised in the Site Editor, and what that
means for the file edits above. If unknown, say so and give the check.>

**Custom blocks registered**
| Block | Static/dynamic | Notes |
| ----- | -------------- | ----- |

**Not changed**
<deliberate omissions and why>

**To verify**
1. Site Editor → Templates: confirm the template appears
2. Front end: <the specific thing to look at>
3. `WP_DEBUG` clean, no theme.json notices
```

## Guardrails

- **Never edit a template or global style file without checking for a database
  override first.** Report the override and the options; do not reset the user's
  customised content to make a file edit visible.
- **Never style a generated block class** (`wp-block-*`, anything with `__`
  separators). Use `className` on the block, or `styles.blocks` in `theme.json`.
- **Never set `customProperties` in `theme.json` to override a core
  `--wp--preset--*` variable.** Core owns those; a theme overriding them
  produces values that differ from what the editor reports.
- **Never put design decisions in PHP filters when they belong in `theme.json`.**
  Filter `theme_json_data_*` output; do not read, mutate, and re-encode the file.
- **Never register a block with a hand-written HTML string in a
  `register_block_type` call** when `block.json` can express it. Use a static
  `save` unless server rendering is required.
- **Never remove a core preset from `settings` without intending to break every
  block that references it.** Removing a spacing or colour preset leaves
  unresolved `var:preset` references rendering as nothing.
- **Never add a `style.css` stylesheet as a real stylesheet** in a block theme.
  It carries the theme header; the design lives in `theme.json`.
- **Never bump `theme.json` `version` speculatively.** Version 3 requires
  WordPress 6.6+; on an older target it is ignored, silently.
- **Never reset customised templates, patterns, or styles without an explicit
  instruction.** The reset is destructive and not obviously reversible.

## Examples

**Input:** "I changed the heading colour in `theme.json` but nothing happened on
the front end"

**Output:**

````markdown
## Diagnosis

`theme.json` is valid — the palette and `styles.elements.heading.color.text`
parse. The change is being overridden, not ignored.

The affected templates are customised in the Site Editor, so they are served
from the database (`wp_template` / `wp_global_styles`) rather than from
`theme.json`. Front-end styles resolve against the stored user global styles,
which were saved before this edit.

**Check**

Run this to confirm before changing anything:

```sql
SELECT post_name, post_status
FROM   wp_posts
WHERE  post_type IN ('wp_template', 'wp_template_part', 'wp_global_styles');
```

**Options**

1. **Edit in the Site Editor** — Appearance → Editor → Styles. Correct for a
   per-site change, and survives future core updates.
2. **Edit the file and reset** — Styles → Styles → Reset, which discards the
   stored global styles. Correct for a change that should apply to every site
   using this theme. Destructive: any hand-made style customisation is lost.

I have not run the reset. Tell me which option and I will make the change.
````

**Why it matters:** It rules out the JSON error, names the actual mechanism,
gives the exact check, and refuses the destructive path. The tempting wrong
answer — "your JSON is malformed" or "clear your cache" — sends the user
somewhere that cannot fix it.

---

**Input:** "add a brand green to the palette"

**Output:** add one entry to `settings.color.palette` with a descriptive name
(`brand-600`), then reference it from `styles` where it should apply by default.
Two checks before reporting: confirm no existing preset is being replaced, and
confirm the contrast of the intended foreground against it, because a new preset
is immediately available to every colour control in the editor and someone will
apply it to text. Report the entry, the contrast result, and whether the Site
Editor's stored styles need a reset for it to appear.

**Why it matters:** A palette addition is small but has two failure modes —
silently replacing a preset, and a colour that passes as a background and fails
as text.
