---
name: {{name}}
description: {{description}}
license: {{license}}
compatibility: {{compatibility}}
metadata:
  author: "{{author}}"
  version: 0.1.0
---

# {{title}}

Replace this paragraph with one or two sentences stating what the skill
accomplishes and when the agent should reach for it. Say it in the imperative:
"Given X, produce Y."

## When to use this

State the trigger conditions in the user's own words, and — just as important —
the near-miss cases this skill does **not** cover. If another skill owns those,
name it.

Do not trigger when:

- the request is a question about the code rather than a change to make
- the work is covered by a more specific skill

## Inputs

Everything the agent needs before it can start. Resolve each one explicitly and
stop to ask if a required input is missing.

| Input | Required | How to obtain it |
| ----- | -------- | ---------------- |
| TODO  | yes      | TODO             |

## Procedure

Numbered, unambiguous steps. One action per step.

1. TODO Gather context.
2. TODO Do the main work.
3. TODO Verify the result before reporting.

## Output format

The exact shape of the deliverable. If the output is code, a diff, a table, or a
file, show a literal example — not a description of one.

```
TODO: replace with the exact expected output shape.
```

## Guardrails

What the agent must never do while running this skill.

- Never TODO.
- Never guess at values that were not supplied; ask instead.
- Never modify files outside the stated scope.

## Examples

**Input:** TODO a realistic request from a user.

**Output:** TODO what the agent should produce, shown in full.

**Why it matters:** TODO one line on what makes this example a good one.

## References

Add a `## References` section only when the skill ships extra files. Create them
with `skills-new <name> --references <file>.md`, then link to them with
relative markdown links so the agent loads them only when needed.
