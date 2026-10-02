---
name: design-tokens
description: Use when setting up, naming, or auditing design tokens and scales — colour, typography, spacing, radii, elevation, motion — in CSS custom properties, theme.json, Tailwind, or a JS theme object. Triggers on "design tokens", "colour palette", "type scale", "spacing scale", "dark mode", "theming", "colour system".
license: MIT
compatibility: opencode, claude-code, codex
metadata:
  author: "@mr-dave-towers"
  version: 1.0.0
---

# Design Tokens

Build a token layer that components can consume without knowing the raw values,
and that a theme or a mode can swap wholesale. A token layer is judged by
whether adding a new surface is a data change, not a code change.

## When to use this

Use it when there is a scale to define or repair: a palette, a type ramp, a
spacing scale, a dark mode, or a token layer that is inconsistently named or
half-adopted.

Do not trigger when:

- **A single component needs a value.** Adding a one-off is a design decision
  in `frontend-design`, not a token layer change. Two uses make a token; one does
  not.
- **The screen is being built.** Route to `frontend-design`; it consumes the
  tokens this skill defines.
- **The stylesheet structure is the problem.** Cascade and file organisation →
  `css-architecture`.
- **The tokens are WordPress `theme.json` settings specifically.** This skill
  covers the naming and scale design; the WordPress-specific mapping and schema
  live in `wordpress-block-theme`.

## Inputs

| Input | Required | How to obtain it |
| ----- | -------- | ---------------- |
| Consumers | yes | Which targets read the tokens: CSS only, CSS + Tailwind, CSS + theme.json, CSS + JS. |
| Existing system | no | Search for custom properties already in use. Never introduce a second system. |
| Brand inputs | no | Brand colours, typefaces, an existing style guide. Absent, generate a starting system and say it is a starting point. |
| Modes | no | Dark mode, high contrast, a per-tenant theme. |
| Density | no | Comfortable vs compact. Produces a second spacing scale, not exceptions. |

Run `rg -n '^\s*--' --glob '*.{css,scss}' | head -100` first. An existing token
layer changes the job from "design one" to "migrate this".

## Procedure

1. **Inventory before designing.** List every colour, size, radius, and duration
   currently hardcoded. The count is the argument for the change and the source
   of most token values. Use a hardcoded-value scan; eyeballing misses most of
   them.
2. **Define the three tiers.** Primitive (raw values, no meaning), semantic (a
   role, theme-swappable), component (rare, only when a component genuinely needs
   its own value). Components consume semantic tokens. This is the rule that
   makes theming possible.
3. **Build the primitive scale first.** The ramp of raw values, generated in one
   consistent colour space. Generate a hue ramp per family at fixed lightness
   then tune chroma, rather than hand-picking eight swatches.
4. **Map primitives to semantic roles.** Decide the role list from what the
   product actually needs, not from a generic template. Cover surfaces, text,
   borders, and interactive states, or dark mode will be a per-component project.
5. **Derive the type scale.** Choose a base size and a ratio per context (UI vs
   editorial), generate the steps, then round each to a value that renders
   cleanly at that size. Clamp fluid sizes between a min and a max.
6. **Derive the spacing scale.** A geometric or near-geometric base, plus
   component-level tokens only where a component's internal rhythm is
   standardised. Do not create a token for every number in the scale.
7. **Define the mode layer as an override, not an inversion.** Dark mode
   redefines the semantic values; it never runs a filter or inverts hue. Every
   semantic role needs a value in every mode, and the surface-to-text contrast
   must be verified per mode, not assumed to carry over.
8. **Verify contrast for every pairing that exists in the UI.** Compute ratios for
   the pairs that are actually used, in every mode. Body text ≥ 4.5:1, large
   text and non-text ≥ 3:1. Tokens exist to be trusted; unverified contrast
   defeats the purpose.
9. **Wire the consumers.** Map tokens into every target the project uses, from
   the same source of truth. A token that only exists in a stylesheet no
   component reads is documentation, not a token.
10. **Migrate incrementally.** Swap one token per component, re-render, then
    delete the hardcoded value. Record what changed.

## Naming

Names are the API. The rule that matters: a name must describe the **role**, not
the value or the appearance.

| Tier | Pattern | Example | Anti-pattern |
| ---- | ------- | ------- | ------------ |
| Primitive | `<category>-<scale>-<value>` | `--color-blue-600`, `--space-4` | Why it exists is fine; how it looks is not |
| Semantic | `<category>-<role>[-<modifier> [--state>]` | `--color-text-secondary`, `--color-border-focus`, `--color-surface-raised` | `--gray-500` used directly by a component |
| Component | `<component>-<part>[-<state>]` | `--button-padding-inline`, `--card-padding-block` | Use only for genuine per-component overrides |

Rules:

- Semantic tokens name roles from the product's vocabulary: surface, content,
  border, muted, accent, danger. If a name would be meaningless in a second
  theme, it is too appearance-specific.
- Never name a token after its value (`--color-5`) in the semantic tier. The
  whole point is that `accent` can change without a rename.
- One convention across colour, space, and time. Do not mix `--space-4` and
  `--spacing-md`.
- Alias consistently, never alias in a loop. `semantic → primitive → value` is
  the only legal shape.

## Scale defaults

Starting values. Deviate with a reason.

| Scale | Base | Ratio | Notes |
| ----- | ---- | ----- | ----- |
| Type, UI | 16px | 1.200–1.250 | Dense product UI. Steps: 12, 14, 16, 20, 24, 30, 36 |
| Type, editorial | 18px | 1.333 | Marketing pages. More contrast between steps |
| Space | 4px | 1.25 geometric | 2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 |
| Radius | 4px | steps, not a ratio | 0, 2, 4, 8, 9999 (pill only) |
| Elevation | — | 2–3 levels | Prefer a border over a shadow at the lowest level |
| Duration | 100–300ms | steps | 100 micro, 200 hover, 300 panel; easing per role |
| Z-index | — | named layers | base, dropdown, sticky, overlay, modal, toast. Never raw numbers in a component |

## Output format

```markdown
## Tokens

<source file> — <n> primitives, <m> semantic, <k> component

**Colour**
| Role | Light | Dark | Contrast (light / dark) |
| ---- | ----- | ---- | ----------------------- |
| `--color-text-primary` | `--gray-900` | `--gray-50` | 15.8:1 / 17.1:1 |
| `--color-text-secondary` | `--gray-600` | `--gray-300` | 5.6:1 / 8.4:1 |
| `--color-accent` | `--blue-600` | `--blue-400` | 5.1:1 / 6.2:1 |

**Type**
| Token | Size | Line height | Weight | Tracking |
| ----- | ---- | ------------ | ------ | -------- |
| `--text-body` | 1rem | 1.6 | 400 | 0 |
| `--text-title` | clamp(1.5rem, 1.2rem + 1.5vw, 2.25rem) | 1.2 | 600 | −0.01em |

**Space** — 4px base, geometric: <list>

**Modes** — light, dark, high-contrast. Every semantic role has a value in each.

**Wired into**
- `<css file>` — the source of truth
- `<tailwind config>` — mapped from the same source
- `<theme.json>` — mapped, where the platform supports it

**Hardcoded values found**
| Location | Value | Becomes |
| -------- | ----- | ------- |
| `hero.css:22` | `#3b82f6` | `--color-accent` |

**Unverified**
<any pairing or mode not contrast-checked>
```

Include a fenced code block of the generated token file, grouped by tier, in the
project's existing format (CSS custom properties, Tailwind `theme.extend`, JS
object — match what the project already uses).

## Guardrails

- **Never have a component consume a primitive token.** `--blue-600` in a
  component is a bug, not a shortcut. The semantic tier is the component's
  vocabulary.
- **Never ship a token nothing consumes.** Unused tokens become permanent
  confusion. If nothing uses it, do not define it.
- **Never create a one-use token.** Two or more uses justify a token; one use is
  a local value.
- **Never implement dark mode by inverting, filtering, or auto-negating.** Each
  semantic role gets a real value per mode.
- **Never assume contrast carries across modes.** Compute every pairing in every
  mode and report the numbers.
- **Never invent a second naming convention in the same project.** If the
  existing one is `spacing-lg`, do not add `--space-8` alongside it.
- **Never leave a migrated hardcoded value behind.** Grep for it before
  reporting done.
- **Never change visual output during a token refactor** except where the audit
  proves it was wrong. A token migration that also redesigns the product cannot
  be reviewed.
- **Never report a contrast ratio you did not compute.** Name the pair and the
  value, or mark it unverified.

## Examples

**Input:** "we need dark mode and the colours are all hardcoded"

**Output:** a role-based semantic layer mapped over the existing values, a real
dark palette, per-mode contrast table, and an incremental migration list:

```markdown
## Tokens

`tokens/colour.css` — 34 primitives, 18 semantic, 0 component

**Colour**
| Role | Light | Dark | Contrast (light / dark) |
| ---- | ----- | ---- | ----------------------- |
| `--color-surface-canvas` | `--white` | `--gray-950` | — |
| `--color-surface-raised` | `--gray-50` | `--gray-900` | — |
| `--color-text-primary` | `--gray-900` | `--gray-50` | 15.8:1 / 17.1:1 |
| `--color-text-secondary` | `--gray-600` | `--gray-300` | 5.6:1 / 8.4:1 |
| `--color-border-default` | `--gray-200` | `--gray-700` | 1.4:1 / 1.5:1 |
| `--color-border-focus` | `--blue-600` | `--blue-400` | 4.6:1 / 5.2:1 |
| `--color-accent` | `--blue-600` | `--blue-400` | 5.1:1 / 6.2:1 |

Note: border tokens are below 3:1 and are marked decorative. If any border
carries meaning (input outlines, focus), it must use `--color-border-focus`.

**Modes** — light (default), dark via `[data-theme="dark"]`, plus a
`prefers-color-scheme` fallback. Every semantic role has a value in both.

**Wired into**
- `tokens/colour.css` — source of truth, defines both tiers
- `tailwind.config.js` — reads the same file; no duplicated hex values
- `app.css` — components switched to semantic roles

**Hardcoded values found**
| Location | Value | Becomes |
| -------- | ----- | ------- |
| `header.css:14` | `#111827` | `--color-text-primary` |
| `card.css:8` | `#f9fafb` | `--color-surface-raised` |
| `buttons.css:31` | `#2563eb` | `--color-accent` |
```

**Why it matters:** It states the primitive count and that there are no component
tokens, flags the one honest problem (decorative borders below the 3:1
non-text threshold), and lists the exact hardcoded values to migrate.

---

**Input:** "add a `--brand-purple` to the palette"

**Output:** refuse the raw-colour name. Ask what the colour is *for*, then
either map it to an existing semantic role or add a new role
(`--color-accent-secondary`) pointing at a primitive. One-off brand colours that
nothing is semantically bound to produce exactly the inconsistency the token
layer exists to remove.

**Why it matters:** A primitive named after a brand colour is the entry point to
a two-system palette, and it is much cheaper to catch here than to unwind later.
