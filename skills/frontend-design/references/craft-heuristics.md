# Craft heuristics

Specific defects that machine-generated UI produces, how to recognise each, and
the fix. Use as a pre-ship checklist, not as a reason to avoid bold choices.

Read this when building a marketing page, landing page, or hero. Skip it for a
dense application screen, where the constraints are different and most of these
do not apply.

## 1. The competing accent

**Symptom:** two or three saturated colours, each used "for emphasis". Buttons,
badges, links, and icons in different hues.

**Why it fails:** the eye cannot rank anything when everything is emphasised, so
the primary action stops standing out. It also reads as template default, because
nobody ships three accents by choice.

**Fix:** one accent, reserved for the primary action and focus. Everything else
is a neutral or a semantic status colour (danger, success, warning) used only for
their meaning.

## 2. Uniform corner radius

**Symptom:** every element is the same radius, including cards, inputs, avatars,
and badges, often with a large value.

**Why it fails:** radius encodes relationship and scale. Equal radius across
different-sized elements reads as unconsidered.

**Fix:** one step for interactive elements, one for containers, pill only for
chips, tags, and toggles.

## 3. The card grid with no reason

**Symptom:** three or four identical boxes with an icon, a bold title, a
sentence, and a "Learn more" link, repeated for every feature.

**Why it fails:** the grid implies the items are equivalent. When features have
different importance, the layout is lying about the product.

**Fix:** if the items are not equivalent, do not make them equal-sized. Give the
primary item more weight. If they genuinely are equivalent, the grid is fine —
but then drop the icons and write real copy.

## 4. Icon as decoration

**Symptom:** an icon above every card heading, in a coloured rounded square, in a
size that competes with the heading.

**Why it fails:** the icons carry no information. They are attention spent on
nothing, and a mismatched set is immediately visible.

**Fix:** an icon earns its place when it is the only label, when it replaces text
that would be longer, or when it is a recognised object in a tool. Otherwise
delete it.

## 5. Text over a busy image

**Symptom:** a centred headline and subhead over a photograph with no scrim, no
gradient, or a gradient too weak for the image.

**Why it fails:** contrast varies per pixel. It passes in review and fails on
every image in the set except the one that was checked.

**Fix:** measure worst-case contrast across the image set, then add a scrim
strong enough for the worst case. If the required scrim destroys the image, the
image is the wrong background.

## 6. Hero vertical centring with a viewport-sized headline

**Symptom:** `font-size: clamp(3rem, 8vw, 8rem)` with a centred single line.

**Why it fails:** a headline at that size is one to three words wide, so it either
wraps awkwardly or leaves a very short measure. Large type needs a narrow measure
and a limit, not an unbounded viewport scale.

**Fix:** cap the size, cap the measure in `ch`, and left-align when the type gets
large. Centred display type is only comfortable in the small-to-medium range.

## 7. The unstated radius of section transitions

**Symptom:** sections with slightly different background colours meeting at a
hard horizontal edge, with the only separation being the colour change.

**Why it fails:** colour-only boundaries are invisible in greyscale and low
contrast for low vision, and they read as an unfinished layout.

**Fix:** separate with space, a rule, or a change in density. Never rely on a
background tint alone as the sole boundary.

## 8. Everything is centred

**Symptom:** centre-aligned headings, body, and cards in every section.

**Why it fails:** centred body text has a ragged left edge, which measurably
slows reading. Centred multi-line text is the single most common reason a page
feels untrustworthy.

**Fix:** centre short standalone items only — a logo lockup, a pricing tier, a
single call to action. Left-align anything that is read in a sequence.

## 9. The missing mobile state

**Symptom:** the desktop layout was scaled down, so the mobile view is a narrow
column with a horizontal scroll and a nav that overflows.

**Why it fails:** mobile was never designed; it was compressed.

**Fix:** build at 375px first. Test at 320px. If a component needs more width
than the viewport, it needs a different layout, not a smaller font.

## 10. Fake credibility

**Symptom:** invented metrics ("10,000+ teams"), a logo wall of companies that
did not use the product, or testimonials without attribution.

**Why it fails:** it is a fabrication the user has to catch and remove, and it is
the most likely part of a build to ship by accident.

**Fix:** use real supplied content, or build the section with a visible
placeholder state. Never invent numbers, logos, or quotes.

## 11. Animation on load

**Symptom:** staggered fade-and-rise on first paint for every element.

**Why it fails:** it delays the content, it is nauseating for some users, it
replays on every navigation, and it is invisible to users with reduced motion
set.

**Fix:** animate on state change, not on load. Keep it under 300ms, transform and
opacity only, and gate it behind `prefers-reduced-motion`.

## 12. The wrapper stack

**Symptom:** three nested `<div>`s with no class between a heading and its
content.

**Why it fails:** each wrapper is a future specificity fight and a dead end for
whoever maintains it.

**Fix:** every element that exists should be styleable. If a wrapper is needed
only for a margin, the child's own margin is the answer.

## Pre-ship pass

Run this before reporting a build as done. Each line is a fast, checkable thing.

- [ ] One accent colour, used for the primary action and focus only
- [ ] Body text is left-aligned and 60–75 characters wide
- [ ] Every vertical gap is a scale value; no magic numbers
- [ ] Exactly one element is the largest text on screen
- [ ] Contrast measured on the worst-case image, not the best
- [ ] No invented metrics, logos, testimonials, or pricing
- [ ] Rendered and inspected at 375, 768, 1280, 1920
- [ ] Empty, loading, and error states exist for each data-driven region
- [ ] Focus ring visible on every interactive element
- [ ] `prefers-reduced-motion` removes transforms
- [ ] No horizontal scroll at 320px
- [ ] Placeholder content is listed in the report
