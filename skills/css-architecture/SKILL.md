---
name: css-architecture
description: Use when organising, refactoring, or reducing CSS in an existing codebase — cascade layers, dead rules, specificity escalation, duplication, naming, file structure, bundle budget. Triggers on "clean up this CSS", "reduce the CSS bundle", "specificity problem", "refactor the stylesheet", "CSS is a mess".
license: MIT
compatibility: opencode, claude-code, codex
metadata:
  author: "@mr-dave-towers"
  version: 1.0.0
---

# CSS Architecture

Refactor a working stylesheet without changing what it renders. The output is a
smaller, ordered, low-specificity stylesheet plus a record of what was removed and
what was verified as safe.

## When to use this

Use it when the CSS itself is the problem: dead rules, the same value in forty
places, `!important` chains, selectors that only work because of specificity
order, a bundle that grew without anyone noticing, or a request to "tidy up the
styles".

Do not trigger when:

- **Nothing is wrong with the CSS but the design looks bad.** Route to
  `ui-polish`; this skill does not judge visual quality.
- **A new screen is being built.** Route to `frontend-design`; it consumes the
  structure this skill maintains.
- **The real problem is inconsistency of visual values.** Route to
  `design-tokens`; this skill is about the cascade, not the palette.
- **The project already has a working architecture.** Do not refactor for its own
  sake. If the file count and layer setup are already sound, say so and stop.

## Inputs

| Input | Required | How to obtain it |
| ----- | -------- | ---------------- |
| The styles | yes | Source files and, if built, the output bundle. |
| Build setup | yes | Read `package.json`, the bundler config, and any PostCSS/Tailwind config. |
| Coverage data | no | Chrome DevTools Coverage panel, or `npx vite-bundle-visualizer`. Establishes what is dead. |
| Visual baseline | no | Screenshots or a review environment. Without one, the refactor is unverifiable — say so. |
| Target | no | A bundle budget, or a specific complaint. Defaults to the smallest safe reduction. |

A visual baseline is not optional for a safe refactor. Without one, plan the work
so each step is individually revertible and tell the user to check the render.

## Procedure

1. **Measure first.** Record the current state: total CSS bytes before and after
   minification, selector count, declaration count, number of `!important`, the
   highest specificity in use, and the number of distinct colour and size values.
   Without a before-number, the result is unfalsifiable.
2. **Classify the problem.** Only one of these is usually the real issue, and the
   fix differs: **dead weight** (unused rules), **duplication** (the same
   declaration repeated), **specificity escalation** (selectors growing to win
   fights), **structure** (no organising principle), or **unbounded cascade**
   (import order decides behaviour). Say which one it is. A bundle that is
   300KB of duplicated declarations is not a layering problem.
3. **Find the dead rules with coverage, not with reading.** Load the app, exercise
   the states — every tab, every modal, every breakpoint, every error state — then
   read the coverage report. Reading a stylesheet top to bottom to find unused
   rules does not work; conditional markup and framework-injected classes hide
   usage. Report the exercise steps so another person can reproduce the coverage.
4. **Establish the order before touching the rules.** Introduce
   `@layer reset, base, layout, components, utilities;` and place existing files
   into layers. Layer order then beats specificity, which is what makes the
   refactor durable. Do this as its own commit-sized step, because it changes
   behaviour where source order was previously load-bearing.
5. **Add cascade layers incrementally.** `@layer` has been baseline in every
   browser since 2022, so this is a real fix, not a workaround. Convert one
   component's selectors at a time.
6. **Collapse specificity with `:where()`.** Wrap a whole selector in
   `:where(...)` to zero its specificity without changing which elements it
   matches. This is the surgical tool: it fixes a fight without a cascade-layer
   migration. `a:where(.nav__link)` matches exactly what `.nav__link` matches and
   contributes zero specificity.
7. **Deduplicate by promoting the shared value.** Three blocks using
   `padding: 16px 24px` is a missing token, not a missing selector. Introduce the
   token, point all three at it, delete the copies. Deduplicating declarations
   without a token produces a new shared class that will drift.
8. **Consolidate structure only where the consolidation is free.** Merge files
   that are always loaded together. Do not build an elaborate directory
   architecture; file count is a weak proxy for maintainability and a strong
   source of merge conflicts.
9. **Verify after every step.** Re-render, or diff the built CSS for unexpected
   deletions. Run the test suite if one exists. Each step must be independently
   revertible — never land a layering migration and a dead-code deletion together.
10. **Report the numbers and the removals.** Byte delta, rule delta, what was
    deleted and how it was proven dead, and any rule kept despite appearing
    unused.

## Choosing the fix

| Symptom | Diagnosis | Fix | Not the fix |
| ------- | --------- | --- | ---------- |
| `!important` in source | Specificity escalation | `:where()`, then a layer | Moving the `!important` |
| Selector like `.a .b .c .d` | Nested convenience classes | Flatten to one class, add the layer | Adding another class |
| Same declaration in many blocks | Missing token | Promote to a custom property | Extending the selector list |
| Rules that never apply | Dead code | Delete, proven by coverage | Commenting out |
| Fix works only in one file | Unordered cascade | `@layer` with a declared order | Reordering `@import`s |
| Bundle grows every release | No budget | Size budget in CI + coverage gate | A quarterly cleanup |
| Global `.button` fights utilities | Name collision | Namespace by block/component | `!important` |
| Media queries everywhere | Layout in the wrong place | Container queries, or grid/flex `auto-fit` | Another breakpoint |

## Verified dead

A rule is safe to delete only when all of these hold:

- Coverage shows it unapplied after every documented interaction path
- No dynamic class or id is constructed at runtime from a string in the codebase
  (search for template literals and concatenation building class names)
- No server-rendered or CMS-authored markup supplies the class — a WordPress
  block, a page-builder module, or an email template can reference any class
- No third-party script injects the markup
- The class is not a documented public API for theme or plugin consumers

The last three are the reason a coverage-based deletion is still a production
risk in a CMS project. Say which ones you checked.

## Output format

```markdown
## Refactor

<files touched> · <n> steps, each independently revertible

**Diagnosis**
<dead weight | duplication | specificity | structure | unbounded cascade>
<one paragraph of evidence>

**Before / after**
| Metric | Before | After | Delta |
| ------ | ------ | ----- | ----- |
| CSS bytes (min) | 284KB | 176KB | −38% |
| Selectors | 4,120 | 2,860 | −31% |
| `!important` | 47 | 0 | −47 |
| Max specificity | (0,4,3) | (0,1,0) | — |
| Distinct hex values | 63 | 12 | −81% |

**Steps**
1. `@layer` order declared; files assigned — reverted by reverting this commit
2. `:where()` on 6 utility selectors — `utilities.css:40`
3. 1,260 dead rules deleted — coverage from these paths: <list>
4. 8 shared declarations promoted to `tokens/space.css`

**Deleted, and how it was proven dead**
| Selector | File | Proof |
| -------- | ---- | ----- |
| `.legacy-hero` | `legacy.css:12` | Coverage after exercising all 6 breakpoints and 3 modals |

**Kept despite appearing unused**
| Selector | Why |
| -------- | --- |
| `.wp-block-cover__inner` | Injected by the CMS editor, not present in the source templates |

**Not changed**
<what was deliberately left alone, and why>

**Unverified**
<what could not be checked without a visual baseline>
```

## Guardrails

- **Never change what renders.** A refactor that alters a computed value is a
  design change. If a value is wrong, report it and route to `ui-polish`.
- **Never delete a rule on the basis of reading alone.** Coverage, plus the four
  dynamic-class and CMS checks, or it stays.
- **Never land a cascade migration and a dead-code deletion in the same step.**
  They are not independently revertible and the bisect is useless.
- **Never introduce `!important` to resolve a conflict.** Zero specificity with
  `:where()` or explicit layer order is the fix.
- **Never restructure files beyond the diagnosis.** A specificity problem does
  not need a new directory tree.
- **Never refactor a stylesheet with no baseline and no coverage tool.** Say the
  work is unverifiable and stop, or ask the user to supply a review environment.
- **Never claim a byte saving you did not measure** before and after with the
  same build command.
- **Never convert a working utility-first setup to a hand-written system**
  because this skill was triggered. Read the existing convention and work in it.
- **Never remove a `@layer` or `:where()` wrapper you do not understand** as part
  of a later cleanup. Those are load-bearing.

## Examples

**Input:** "our CSS is 400KB and the homepage is slow, can you clean it up?"

**Output:** a measurement-first diagnosis, not a rewrite:

```markdown
## Refactor

`app.css`, `components.css`, `legacy.css` · 4 steps, each revertible

**Diagnosis**
Unbounded cascade plus dead weight. 47 `!important` declarations trace to two
block components (`.wp-block-buttons` and `.pricing-card`) competing over
`border-radius`, and 1,260 rules are uncovered after exercising every breakpoint
and all three modals. Layer order was never declared, so source order in a
12-file concatenation decided all 47 of those fights.

**Before / after**
| Metric | Before | After | Delta |
| ------ | ------ | ----- | ----- |
| CSS bytes (min) | 412KB | 241KB | −41% |
| Selectors | 6,940 | 4,110 | −41% |
| `!important` | 47 | 0 | −47 |
| Max specificity | (0,4,3) | (0,1,0) | — |
| Distinct hex values | 71 | 14 | −80% |

**Steps**
1. Declared `@layer reset, base, layout, components, utilities;` and assigned
   all 12 files — this alone resolves 39 of the 47 `!important` fights
2. `:where()` on 8 shared utility selectors — `utilities.css:40`
3. Deleted 2,830 uncovered rules
4. Promoted 8 repeated padding declarations to `--space-*`

**Deleted, and how it was proven dead**
| Selector | File | Proof |
| -------- | ---- | ----- |
| `.hero--split` | `legacy.css:340` | Uncovered at all 4 breakpoints, both modals |
| `.cta--ribbon` | `legacy.css:512` | No reference in source, no runtime class construction, no CMS reference |

**Kept despite appearing unused**
| Selector | Why |
| -------- | --- |
| `.wp-block-columns` | Injected by the block editor; the markup is not in the theme |
| `.has-vivid-color-background-color` | Applied by core from a block attribute |

**Not changed**
`legacy.css` kept as a layer rather than merged — merging doubled the merge
conflict surface on the two files that touch it most.

**Unverified**
No review environment was available, so the visual diff was not checked beyond
re-running the production build. Verify the two block components on a page that
uses them.
```

**Why it matters:** It names the diagnosis, shows the `!important` count going to
zero through layering rather than relocation, proves the deletions, and — the
part that matters — admits the visual diff was not verified instead of implying
it was.

---

**Input:** "use BEM everywhere and split this up into one file per component"

**Output:** push back and offer the diagnosis first. If the actual complaint is
specificity, `:where()` plus layers fixes it with no naming migration and no
file-per-component churn. If the complaint is bundle size, coverage and dead-code
deletion address it directly. A naming and file-structure migration on a working
stylesheet is a large, high-conflict diff that does not fix any measured problem.
Establish the diagnosis, then propose the smallest change that resolves it.

**Why it matters:** "Clean up this CSS" defaults to a restyle, and a restyle on a
working stylesheet is a regression risk with no measurable benefit.
