---
name: frontend-design
description: Use when building a new page, section, or screen from a brief, mockup, or screenshot in HTML/CSS or a framework. Triggers on "build this page", "design this section", "make this look good", "implement this mockup", "build a hero", "style this layout".
license: MIT
compatibility: opencode, claude-code, codex
metadata:
  author: "@mr-dave-towers"
  version: 1.0.0
---

# Frontend Design

Build one screen that looks deliberate, at every width, with every state handled.
The job is judgement about hierarchy and rhythm, not producing markup. Output is
a working file plus a short list of the decisions taken.

## When to use this

Use it when there is a thing to build and a description of what it should do: a
copy-pasted brief, a Figma link with named frames, a screenshot, a competitor's
page, or "make the checkout page better".

Do not trigger when:

- **An existing UI needs a defect pass rather than a design.** Route to
  `ui-polish`; it works from measurable checks and produces a fix list.
- **The design system itself is the subject.** Route to `design-tokens` for
  colour, type, and spacing scales, or `component-library` for component APIs.
- **The CSS is the problem.** Messy selectors, dead rules, specificity wars →
  `css-architecture`.
- **The request is a question.** "Should this be a grid or a flex?" is an
  answer, not a build.

When two apply, this skill is the outer one: it establishes hierarchy and
spacing, and delegates the scale to `design-tokens` and the component contract
to `component-library`.

## Inputs

| Input | Required | How to obtain it |
| ----- | -------- | ---------------- |
| What to build | yes | The request itself. If it is "a page", ask which section or screen. |
| Content | yes | Real copy and real data shapes. Ask for them, or state the placeholder set being used. |
| Target stack | no | Detect from the project. Otherwise default to semantic HTML + CSS custom properties, no framework. |
| Constraints | no | Existing tokens, breakpoints, browser support, performance budget. Read the project's own CSS first. |
| Reference | no | A Figma URL, screenshot, or an existing page in the codebase to match. |

Never invent product copy and present it as real. If the user has not supplied
content, use obviously-stand-in text and list it in the report as a swap-out
list.

## Procedure

1. **Read the surroundings before designing anything.** Find the existing
   tokens, the base stylesheet, the typography setup, and one comparable screen.
   A new section that ignores the established scale is a defect even if it looks
   good in isolation. Run `rg -n '^\s*--[a-z]' --glob '*.css'` and read the
   `:root` block.
2. **Write the content inventory before the layout.** List every element the
   screen needs, in DOM order, with the data each one needs. Anything not in
   this list does not get built. This is what stops a design from decaying into
   a pile of decorative wrappers.
3. **Establish the hierarchy on paper.** Identify the one element the eye should
   land on first, the second, the third. Assign type size, weight, and colour
   from the existing scale. If two elements are fighting for the same rank,
   the design is unresolved — fix that before writing CSS.
4. **Choose the layout primitive deliberately.** Grid for two-dimensional
   relationships (page shell, card grids, dashboards). Flexbox for one axis
   (toolbars, inline clusters, button groups). Intrinsic sizing (`minmax`,
   `clamp`, `auto-fit`) over breakpoint-specific column counts wherever the
   item count is unknown. Do not reach for a 12-column grid by reflex.
5. **Set the vertical rhythm before any styling.** Every vertical gap is a
   multiple of the spacing unit, and every text style has a line-height that
   keeps its own rhythm. Rhythm breaks are the single most common reason a
   layout looks amateurish, and they are invisible to the person who wrote it.
6. **Build mobile-first with content-driven breakpoints.** Start at the
   narrowest viewport. Add a breakpoint only where the layout actually breaks,
   and record why. Three or four breakpoints is a ceiling, not a target.
7. **Handle every state, not just the default.** For each interactive or
   data-driven element: default, hover, focus-visible, active, disabled, loading,
   empty, and error. Design the empty and error states at the same time as the
   populated one — they are what a real page is made of.
8. **Make it operable.** Semantic elements first, then roles. Visible focus
   rings. Logical properties (`margin-inline`, `padding-block`) so the layout
   survives RTL. Touch targets ≥ 44×44px. Respect
   `prefers-reduced-motion` and `prefers-contrast`. Check contrast at the sizes
   actually used.
9. **Render it and look at it.** If a browser or screenshot tool is available,
   render at 375, 768, 1280, and 1920 and actually inspect the result before
   reporting. Text overflow, collapsed grid tracks, and unexpected wrapping are
   only visible in a render.
10. **Report the decisions and the unknowns.** List the scale values used, the
    breakpoints added and why, the components that already existed versus the
    ones introduced, and the content that is still placeholder. Offer the
    follow-on skills rather than performing them.

## Composition defaults

Use these unless the project's own system says otherwise. Deviating is fine;
deviating silently is not.

| Decision | Default | When to break it |
| ------- | ------- | ---------------- |
| Measure | 60–75 characters for body text (`max-width: 65ch`) | Full-bleed media, data tables, dashboards |
| Vertical gap | Multiples of the spacing unit; larger gap signals a stronger grouping | Exact optical corrections under an inline icon |
| Type scale | 1.200–1.333 for dense UI, 1.414+ for marketing pages | Never below 1.125 (the steps stop reading as steps) |
| Alignment | One left edge per region. Ragged-right is fine, ragged-left is not | Centred text only for short standalone items |
| Colour | One accent, used for the primary action and focus only | Multiple accents need a token reason, not taste |
| Radius | One step for interactive, one for containers | Pills only for chips, tags, and toggle groups |
| Elevation | 0–2 levels of shadow. Prefer a border over a shadow at level 1 | Overlay surfaces (popovers, modals) |
| Breakpoints | 3–4, each at a point where the layout genuinely breaks | Never a breakpoint that only changes a font size |

**Proportion beats decoration.** If removing an element does not break the
layout or the meaning, it is decoration — cut it. The most common failure mode
of an AI-built screen is not ugliness; it is five competing accent colours and a
wrapper `<div>` for every value.

## States checklist

Run this per interactive or data-driven element before reporting done.

- [ ] Default, `:hover`, `:focus-visible`, `:active` are all visually distinct
- [ ] `:focus-visible` is never removed without a better replacement
- [ ] Disabled is visually distinct *and* does not rely on opacity alone
- [ ] Loading does not shift layout: reserve the space with the final dimensions
- [ ] Empty state explains what would appear here and how to get there
- [ ] Error state names the failure and offers the next action
- [ ] Long text (a 60-character title), long unbroken strings (URLs, IDs), and
      zero items have all been considered
- [ ] Reduced motion removes transform/opacity animation, not just duration
- [ ] Forced-colors mode does not erase the component

## Output format

Deliver the file, then the report. The report is the part that lets the user
reject your decisions; do not bury it.

```markdown
## Built

<file> — <what it is, one line>

**Decisions**
- Type: <step> / <weight> for the hero, <step> / <weight> for body, from the project's scale
- Spacing: <unit> base, section gaps at <values>
- Breakpoints: <values> — added because <the specific thing that broke>
- Layout: grid for <what>, flex for <what>
- Accent: <token>, reserved for <what>

**States covered**
<element> — <states implemented>

**Placeholder content**
- "<copy>" → needs real <thing>
- <data field> — currently empty array

**Reused**
<existing component or token used instead of a new one>

**Not done**
<anything cut for scope, and the follow-on skill that would handle it>
```

## Guardrails

- **Never invent product copy and present it as final.** Placeholder text is
  fine; silently fabricated marketing claims are not.
- **Never skip the empty, loading, or error state** because the brief showed a
  populated screenshot. Real pages are mostly these states.
- **Never introduce a second accent colour or a second spacing scale** to solve
  a local problem. Extend the existing scale or reuse it.
- **Never ship a layout you have not seen rendered** at more than one width when
  a rendering tool is available. If none is available, say so in the report.
- **Never add a wrapper element** purely to hold a margin or a colour. Use the
  element's own margin or a real container.
- **Never use `!important` to win a cascade fight in new code.** Fix the
  specificity; hand the fight to `css-architecture`.
- **Never remove a focus outline** without replacing it with something at least
  as visible.
- **Never build the whole page when the user asked for a section.** Scope to the
  request, then offer the rest.
- **Never add a carousel, an icon font, or a motion library** unless the brief
  requires it. Dependency-free is the default.
- **Never claim a contrast ratio you did not compute.** Name the pair and the
  size, or say it is unverified.

## Examples

**Input:** "Build a pricing section for a SaaS landing page, three tiers, annual
billing has a discount."

**Output:** a semantic `<section>` with a heading, a three-item `<ul>` of tier
cards, the discount expressed as data in the markup (not hardcoded into one
card's text), a `<table>` or `<dl>` for the feature comparison, and states for
the CTA. Report:

```markdown
## Built

`pricing.html` — three-tier pricing section with annual/monthly toggle.

**Decisions**
- Type: 32/1.25 for the section heading, 20/1.5 tier names, 16/1.6 body
- Spacing: 4px base; tier cards at 24px internal, 32px between
- Breakpoints: 768px — 3 columns collapse to 1, because a 3-up grid at 768
  leaves 240px per card and the feature lists wrap to 3 lines
- Layout: grid for the tier row, flex column inside each card
- Accent: `--color-accent`, on the featured tier's CTA and the price only

**States covered**
- Billing toggle — default, hover, focus-visible, checked; annual price
  pre-computed in a `data-annual` attribute so the swap is not a re-render
- Tier CTA — default, hover, focus-visible, active, disabled (featured tier)
- Feature comparison — full at ≥768px, collapsed to a per-tier list below

**Placeholder content**
- Tier names and prices → need real pricing
- Feature list → 6 rows shown, 11 exist; rest render from the data array

**Reused**
- `--space-*` and `--text-*` from `tokens.css`; `Button` from `ui/button.css`

**Not done**
- Comparison table is a `<dl>`, not a real `<table>` with row/column headers.
  Needs `table` semantics for screen readers — say so.
```

**Why it matters:** The report is where the user can see the discount was
modelled as data, that the breakpoint has a reason, and that the copy is fake.
The build alone would hide all three.

---

**Input:** "This hero looks generic, can you make it better?"

**Output:** ask which of the two things they want before writing anything —
a critique of the current hero (route to `ui-polish`) or a rebuild from a brief
(this skill). If they confirm a rebuild, get the content and the one message the
hero must land, then build. Do not produce a redesign speculatively from a
one-line complaint; the failure mode is replacing a working hero with a
different generic hero.

**Why it matters:** "Make it better" is ambiguous between audit and rebuild, and
guessing wastes the whole task on the wrong deliverable.

## References

- [Craft heuristics](./references/craft-heuristics.md) — the specific defects
  generated pages have, how to spot each one, and the fix. Read before
  building a marketing or landing-page section; skip for a dense app screen.
