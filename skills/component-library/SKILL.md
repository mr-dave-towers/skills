---
name: component-library
description: Use when designing the API of a reusable UI component — props, variants, slots, states, accessibility contract, docs, versioning, deprecation. Triggers on "build a component library", "design a component API", "make this reusable", "component variants", "design system component".
license: MIT
compatibility: opencode, claude-code, codex
metadata:
  author: "@mr-dave-towers"
  version: 1.0.0
---

# Component Library

Design component APIs that survive their tenth use, when the eleventh use is not
the one you predicted. The judgement is about the boundary between what a
component owns and what the caller owns, and about how many booleans a prop API
can absorb before it becomes a lookup table.

## When to use this

Use it when something is being built to be reused: a component extracted from a
page, a design system component, a shared UI primitive, or a review of a
component's public surface.

Do not trigger when:

- **The component is used once.** Build it inline in `frontend-design` and
  extract it when the second use appears. Premature abstraction is a real cost,
  not a neutral bet.
- **A specific screen needs building.** Route to `frontend-design`; it consumes
  components from this skill.
- **The problem is visual quality of a built thing.** Route to `ui-polish`.
- **The problem is the styling architecture behind the components.** Route to
  `css-architecture` or `design-tokens`.

## Inputs

| Input | Required | How to obtain it |
| ----- | -------- | ---------------- |
| Use cases | yes | The two or three concrete places it will be used. A component with one use case has no API. |
| Environment | yes | Framework and version, styling approach, whether SSR. |
| Existing conventions | yes | Read the project's components. Match them; do not import a foreign pattern. |
| Accessibility bar | no | The project's stated target. Default to WCAG 2.2 AA. |
| Distribution | no | Internal app, or published package. Changes the versioning and deprecation obligations. |

## Procedure

1. **Read the existing components.** Match the project's naming, file layout,
   prop conventions, styling approach, and export style. A new component in a
   different idiom costs more than a mediocre component in the house style.
2. **Write the use cases down first.** Two or three concrete sentences: who
   passes what, and what varies. If the list has one entry, say the component
   should not be extracted yet.
3. **Separate owned from passed.** Decide what the component owns (internal
   structure, spacing, states, a11y wiring) and what the caller owns (content,
   placement, business logic). Put every variation the caller controls on a prop
   or slot, and every variation the component controls inside the component. This
   single decision prevents most API rot.
4. **Prefer slots over configuration.** A slot takes a node; a configuration prop
   takes a description that the component has to turn back into a node. When a
   prop starts describing layout ("iconPosition", "labelBelow", "stacked"), the
   component should expose a slot instead. If two boolean props can only appear in
   one valid combination, they are one variant.
5. **Design the state matrix before the styling.** Default, hover, focus-visible,
   active, disabled, loading, invalid, read-only, plus any data states. Write the
   matrix as a table in the output. A component shipped with a missing state is
   the most common defect, and the matrix is what prevents it.
6. **Fix the accessibility contract in the API, not the docs.** Decide the role,
   the keyboard behaviour, the labelling requirement, and the focus management
   before writing markup. Expose the prop that makes labelling possible
   (`aria-label`, `labelledby`, or a required visible label) rather than hoping
   the caller passes one. A component that cannot be labelled correctly is not
   shippable, regardless of how it looks.
7. **Model the data contract.** Define prop types, which are required, which
   have defaults, and what happens on an invalid or empty value. A component that
   throws on a missing prop is a component that pages down at 3am.
8. **Decide the styling boundary.** Own the styles and expose a variant/class
   escape hatch, or accept a `className`/`sx`. Owning everything is a
   maintenance trap; owning nothing is a design system in name only. The
   defensible position: own the essentials, allow one documented escape hatch.
9. **Write the docs as usage, not as a prop table.** Two or three real examples
   covering the default and the two most likely uses, plus a copy-pasteable
   snippet. A prop table is reference; examples are documentation.
10. **Decide the versioning and deprecation policy up front** if the component is
    published. Additive props are minor; a required prop or a changed default is
    a major. Never change a prop's meaning in a patch.

## API design rules

| Rule | Why | Example |
| ---- | --- | --- |
| Two use cases minimum before extracting | A component built for one caller is a component nobody maintains | Inline until use two |
| Slots beat configuration props | A slot passes a node; a config prop re-encodes one | `leading` slot over `iconPosition` |
| Variants are for visual identity, not layout | Layout variants multiply combinatorially | `tone`, not `fullWidth` + `align` |
| Booleans pair into variants at three | `a`, `b`, `a && b` is one state, not two | `size="sm" \| "md" \| "lg"` |
| Never a boolean named for a negation | `disabled={false}` reads wrong and defaults badly | `disabled` is the exception that proves the rule; prefer `readOnly` over `editable` |
| Defaults live in the component | A caller's default is a second source of truth | `size = "md"` inside |
| Own spacing, expose one escape hatch | Design systems that own nothing are not systems | `className` documented as escape only |
| Required props must be truly required | Optional props that are effectively mandatory are traps | Mark optional, document the fallback |
| No prop that exists for one caller | The component learns the caller's business rules | Take a slot or a node instead |
| Accessibility is not a prop bag | Contract first, then markup | Role and keyboard fixed; labelling exposed |

## Output format

```markdown
## Component: `<Name>`

<one line: what it is and what it replaces>

**Owns** — internal structure, padding, states, focus ring, a11y wiring
**Caller owns** — content, placement, link/handler wiring

**API**
| Prop | Type | Default | Required | Notes |
| ---- | ---- | ------- | -------- | ----- |
| `tone` | `"default" \| "danger" \| "ghost"` | `"default"` | no | Visual intent only, never state |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | no | Drives height and padding together |
| `loading` | `boolean` | `false` | no | Reserves width; sets `aria-busy` |
| `disabled` | `boolean` | `false` | no | Sets `aria-disabled`, keeps focusability |
| `leading` | `ReactNode` | — | no | Slot; unstyled |

**State matrix**
| State | Default | Ghost | Danger | Notes |
| ----- | ------- | ----- | ------ | ----- |
| rest | filled | transparent | filled | — |
| hover | darken 6% | bg-weak | darken 6% | |
| focus-visible | 2px ring | 2px ring | 2px ring | Never removed |
| active | darken 10% | bg-stronger | darken 10% | |
| disabled | 40% opacity + `aria-disabled` | same | same | Opacity never the only signal |
| loading | spinner in slot | same | same | `aria-busy`, width preserved |

**Accessibility contract**
- Role: `button` (native `<button>`), or `a` when the caller passes `href`
- Keyboard: native; focus ring on `:focus-visible` only
- Labelling: `aria-label` required when no visible text child
- Announced: `aria-busy` when loading, `aria-disabled` when disabled
- Contrast: label 7.1:1 on default, 4.6:1 on danger

**Use cases covered**
1. <the primary use>
2. <the second use, proving the slots>

**Usage**
<two or three copy-pasteable examples>

**Versioning**
<which changes are additive, which are breaking>

**Not covered**
<what the caller must still do — e.g. server-side validation>
```

## Guardrails

- **Never extract a component with one use case.** Inline it, note the second use
  in the report, and move on.
- **Never add a prop for one caller's need.** A component that learns a specific
  screen's rules is a component coupled to a screen. Take a slot or a node.
- **Never design a prop that re-encodes markup** ("iconPosition", "withIcon",
  "showArrow"). Those are slots wearing a prop's clothes.
- **Never ship without the full state matrix**, at minimum default, hover,
  focus-visible, disabled, and loading.
- **Never use opacity as the only disabled signal.** Pair it with
  `aria-disabled` and a visible change.
- **Never remove a focus ring to make a variant work.** The ring is the
  accessibility contract, not a style.
- **Never change a prop's meaning, type, or default in place.** Add a new prop and
  deprecate the old one, or ship a major.
- **Never import a design-system pattern that contradicts the project's existing
  conventions** without saying why.
- **Never describe the API in prose only.** The state matrix and the prop table
  are the deliverable; prose around them is commentary.

## Examples

**Input:** "we need a button — we'll use it in four places"

**Output:**

```markdown
## Component: `Button`

Replaces the four inline `<button class="btn btn--…">` usages. No library
dependency.

**Owns** — height, padding, radius, focus ring, disabled/loading behaviour,
a11y wiring
**Caller owns** — label, leading/trailing content, onClick, href

**API**
| Prop | Type | Default | Required | Notes |
| ---- | ---- | ------- | -------- | ----- |
| `tone` | `"default" \| "danger" \| "ghost"` | `"default"` | no | Visual intent only |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | no | Sets height and padding together |
| `loading` | `boolean` | `false` | no | Reserves width, sets `aria-busy` |
| `disabled` | `boolean` | `false` | no | Keeps focusable, sets `aria-disabled` |
| `leading` | `ReactNode` | — | no | Slot, unstyled — for an icon or spinner |
| `href` | `string` | — | no | Renders `<a>` instead of `<button>` |

**State matrix**
| State | Default | Ghost | Danger |
| ----- | ------- | ----- | ------ |
| rest | solid `--color-accent` | transparent, 1px border | `--color-danger` |
| hover | darken 6% | `--color-surface-raised` | darken 6% |
| focus-visible | 2px `--color-border-focus`, 2px offset | same | same |
| active | darken 10% | `--color-border-default` | darken 10% |
| disabled | 40% opacity, `aria-disabled` | same | same |
| loading | `leading` slot, `aria-busy` | same | same |

**Accessibility contract**
- Native `<button>` by default, `<a>` when `href` is set — never a `<div>`
- Focus ring on `:focus-visible` only, never removed
- `aria-label` required when there is no visible text child
- Contrast 7.1:1 label on default, 4.6:1 on danger

**Use cases covered**
1. Primary submit in the checkout form — `tone="default"`
2. Destructive "delete workspace" with a confirm — `tone="danger"` + `loading`
3. Toolbar filter toggle — `tone="ghost" size="sm"` with a `leading` icon

**Usage**
<three snippets, one per use case>

**Versioning**
Additive: new `tone` or `size` member. Breaking: new required prop, removed
`size` member, changed default.

**Not covered**
Server-side confirmation. The component is a trigger, not a guard.
```

**Why it matters:** `leading` is a slot rather than `hasIcon`, so the four call
sites are covered without a new prop; `tone` carries visual intent only, so
`danger` never drifts into meaning "the primary destructive thing" plus a layout
change; and the `href` rule removes the single most common a11y defect in button
libraries — a clickable `div`.

---

**Input:** "add a `fullWidth` prop to the button"

**Output:** refuse, and offer the two real options. A `fullWidth` boolean is a
layout concern the caller already owns — putting it on the component couples the
button to its container. The caller sets width on its own wrapper or uses the
container's `display: grid` with the button as a grid item stretched to fill.
If genuinely every use needs it, the layout is the pattern, not the component.
Then check whether `fullWidth` was a symptom: if the reason it was requested is
"the button looks wrong in the form", the real prop might be `size` or the
form's grid, not width.

**Why it matters:** Layout props are the leading edge of a component's coupling
to its callers, and the request always arrives looking harmless.
