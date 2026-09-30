---
name: ui-polish
description: Use when auditing or refining existing UI against a design quality bar — spacing, hierarchy, alignment, states, typography, contrast, motion. Triggers on "make this look better", "polish this", "why does this look off", "design review", "audit the UI", "does this pass".
license: MIT
compatibility: opencode, claude-code, codex
metadata:
  author: "@mr-dave-towers"
  version: 1.0.0
---

# UI Polish

Find the small number of things making a screen look unconsidered, and fix them
in one pass. The deliverable is a ranked list of specific defects with a fix
each — not a redesign, and not a compliment sandwiched with rewrites.

## When to use this

Use it when the UI exists and something is visibly off but the request does not
name a cause: "this looks amateur", "the design feels inconsistent", "does this
pass", a screenshot pasted with no other comment.

Do not trigger when:

- **There is nothing built yet.** Route to `frontend-design`.
- **The user wants a critique with no code change.** Do the audit, stop before
  editing, and say that is what you did.
- **The CSS itself is unmaintainable.** Duplicated rules, dead selectors,
  specificity escalation → `css-architecture`. This skill judges what renders,
  not how the stylesheet is organised.
- **A specific component needs a reusable API.** Route to
  `component-library`.

## Inputs

| Input | Required | How to obtain it |
| ----- | -------- | ---------------- |
| The UI | yes | A file, a route, a component, or a screenshot. |
| Reference bar | no | A brand guide, a design system, an existing polished screen in the same product. Without one, the bar is generic craft. |
| Scope | no | Defaults to the named screen. If a whole flow is named, audit every screen in it. |
| Rendering access | no | If a browser is available, render and measure. If not, say the audit is static. |

## Procedure

1. **Render before judging.** Open the screen at 375, 768, 1280, and 1920, in
   light and dark if both exist. A static read of the CSS misses wrapping,
   overflow, and collapse. If no rendering is available, state that the audit is
   static and that layout claims are unverified.
2. **Collect the inventory.** Enumerate the distinct visual components on the
   screen. Most polish work is "this thing appears four times and is styled four
   slightly different ways", so the component list is the work list.
3. **Measure, do not eyeball.** Use the devtools inspector to record actual
   values: font sizes and weights, colour values, spacing, radii, border widths,
   shadow values. Eyeballing finds 60% of the defects and invents the rest.
4. **Run the checks below in order.** Hierarchy, then spacing and rhythm, then
   alignment, then typography detail, then colour, then states, then motion.
   Early fixes change what later checks see; doing them out of order produces
   findings against a layout that no longer exists.
5. **Look for the duplication clusters.** Group findings that have one root
   cause — four instances of the same wrong value is one finding with four
   locations, not four findings.
6. **Rank by cost-to-fix against cost-if-ignored.** A 1px misalignment on a
   primary CTA outranks a missing hover state on a tertiary link.
7. **Fix, then re-render and re-check the checks you fixed.** Re-render
   deliberately. Verify the focus ring is still visible after any colour change
   and that the layout did not shift.

## Checks

Each check is pass/fail. A finding must cite the measured value, the expected
value, and the location.

| Check | Pass condition | Typical fix |
| ----- | -------------- | ----------- |
| Visual hierarchy | Exactly one element is the largest text on screen | Reduce a competing heading; do not enlarge the target |
| Heading order | No skipped levels; one `<h1>` per view | Re-tag `div` → `h2` |
| Body measure | 60–75 characters | `max-width: 65ch` on the text container |
| Line length vs size | Line-height 1.5 for body, 1.1–1.3 for display, at the size used | Set per step, not globally |
| Spacing scale | Every vertical gap is a named scale value | Replace the magic number |
| Rhythm | Sibling vertical gaps are equal; group gaps are larger | Establish two levels, then re-check |
| Alignment | One left edge per region; no 1–3px ragged misalignment | Snap to the grid; use the container, not a hardcoded offset |
| Optical alignment | Icons align to text, not the text box | `vertical-align` plus a small negative offset |
| Weight range | At most 3–4 weights in use; a weight never used for a disabled state alone | Delete the unused weight |
| Colour count | 1 accent, plus neutrals; ≤ 5 hues total | Desaturate the second accent |
| Contrast (body) | ≥ 4.5:1 | Darken the text or lighten the surface |
| Contrast (large) | ≥ 3:1 for ≥ 24px, or ≥ 18.66px bold | Same |
| Non-text contrast | ≥ 3:1 for borders, icons, focus rings, form outlines | Darken the border |
| Focus visibility | Every interactive element has a visible `:focus-visible` | Add a ring; never `outline: none` alone |
| State coverage | Default, hover, focus-visible, active, disabled all present | Add the missing states |
| Touch target | ≥ 44×44px, or a documented exception | Pad the hit area, not the visual box |
| Tap highlight | `suppressClickableElementName` absent on iOS-treated elements | Check `-webkit-tap-highlight-color` |
| Layout shift | Nothing reflows on load, hover, or state change | Reserve space for images and async content |
| Overflow | No horizontal scroll at 320px; long words wrap | `min-width: 0` on flex children, `overflow-wrap` |
| Motion | ≤ 300ms for UI, ≤ 200ms for hover, transform/opacity only | Shorten or remove |
| Reduced motion | `prefers-reduced-motion` removes transforms and parallax | Add the media query |
| Empty/loading/error | Each data-driven view has all three | Build the missing state |
| Density | Related controls in the same group are the same height | Normalise to one control height |
| Icon consistency | One icon set; stroke width constant | Replace the outlier set |
| Focus order | Tab order follows reading order | Fix positive `tabindex`, not `tabindex="-1"` |
| Landmark structure | One `main`, nav landmarks labelled, skip link present | Add the missing landmark |
| Language and title | `<html lang>` set; document title unique per view | Add `lang`; make titles specific |

## Output format

```markdown
## Audit

<screen or component> · rendered at 375/768/1280/1920 · <light/dark> · <n> findings

### 1. <rank>. <short defect name> — <highest-impact file:line>

**Measured:** <actual values, with the units>
**Expected:** <the value or property that is wrong>
**Why it matters:** <the visual or interaction consequence, in one sentence>
**Fix:** <the concrete change>

### 2. …

### Duplication clusters
| Component | Appearances | Inconsistent at | Single fix |
| --------- | ----------- | --------------- | ---------- |

### Verified clean
<checks that passed, one line each — this is what stops a re-audit>
```

Rules:

- Order by impact, not by file.
- Merge findings with one root cause. Cite every location in the merged finding.
- A finding without a measured value is a guess; measure it or drop it.
- "Consider…" is not a fix. Give the change.
- State which checks passed. A bare list of problems reads as a failed page.

## Guardrails

- **Never rewrite the layout while auditing.** Report first, then ask. An audit
  that silently restructures is not reviewable.
- **Never report a defect without a measured value.** "The spacing feels
  inconsistent" is not a finding; "28px, 24px, 32px, 24px in the same stack" is.
- **Never inflate the count.** Four instances of one bug is one finding. A list
  of forty is a failure to rank.
- **Never invent brand colours, fonts, or copy to make a check pass.** If the
  design system cannot be found, audit against generic craft and say the
  reference bar is missing.
- **Never remove a focus ring or lower contrast** to make a check pass. Contrast
  and focus are not stylistic preferences.
- **Never claim a render you did not perform.** No browser, no layout claims.
- **Never fix a symptom upstream.** A misaligned row is a spacing-source
  problem; do not patch the one row.
- **Never apply changes across more files than the audit covers** without
  saying so in the report.

## Examples

**Input:** "does this settings page pass?" (pasted a screenshot)

**Output:**

```markdown
## Audit

Settings page · static only (no browser available) · 6 findings

### 1. Three different control heights
**Measured:** email input 44px, password input 44px, timezone `<select>` 36px
**Expected:** 44px on all controls in a form row
**Why it matters:** the row reads as broken, and the small control is below the
44px touch target
**Fix:** add `min-height: var(--control-height)` to the select in
`settings.css:88`

### 2. Two competing headings
**Measured:** `<h1>` 24px/1.4, section heading 24px/1.4 — identical
**Expected:** one dominant size per view
**Why it matters:** nothing on the page is the page title
**Fix:** section headings to 18px/1.4 in `settings.css:31`

### Duplication clusters
| Component  | Appearances | Inconsistent at | Single fix |
| ---------- | ----------- | --------------- | ---------- |
| Form row   | 6           | `settings.css:41,88,132` | Extract `.field-row` with one gap |
| Save button | 2          | inline styles both places | Promote to `.btn--primary` |

### Verified clean
- Body contrast (7.2:1), heading order, landmarks, focus ring present on all
  controls, motion within 200ms
```

**Why it matters:** It says the audit was static, separates the two real bugs
from the noise, and lists what already passes so the next pass does not re-check
it. The screenshot alone could not show the 36px select.

---

**Input:** "the whole settings and billing flow feels off, fix it"

**Output:** ask for the routes in the flow and the intended priority — an audit of
all screens, or a rebuild. If the request stays as given, audit every screen
first, report one merged ranked list, and only then propose the fixes. Do not
start editing screen one while screens two to five are unaudited; the defects are
mostly shared, and fixing the root while a second screen shows the same bug
produces two rounds of churn.

**Why it matters:** The shared root cause is the finding that matters, and it is
invisible until every screen has been looked at.
