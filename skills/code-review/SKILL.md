---
name: code-review
description: Use when reviewing a pull request, branch diff, patch, or uncommitted changes for correctness, security, regressions, and maintainability. Triggers on "review this PR", "review my changes", "code review", "check this diff", "look over this before I merge", "is this ready to ship".
license: MIT
compatibility: opencode, claude-code, codex
metadata:
  author: "@mr-dave-towers"
  version: 1.0.0
---

# Code Review

Turn a diff into a short, ranked list of defects an engineer would actually act
on. The goal is not to demonstrate thoroughness; it is to catch the two or three
things that will break in production, and to stay quiet about everything else.

## When to use this

Use it when there is a concrete change to judge: a PR, a branch versus its base,
a patch file, or `git diff` output.

Do not use it for:

- **Open-ended "look at this codebase" requests.** There is no diff to bound the
  review. Explore instead.
- **Writing the change.** If the user wants an implementation, switch to the
  `build` agent first; reviewing code you just wrote without a fresh pass rarely
  catches anything.
- **Style nits the formatter or linter already owns.** If `biome`, `prettier`,
  `eslint` or `ruff` can decide it, do not re-litigate it in prose.

## Inputs

Resolve these before reviewing. Ask for whichever is missing and not inferable.

| Input | Required | How to obtain it |
| ----- | -------- | ---------------- |
| The diff | yes | `gh pr diff <n>`, `git diff <base>...HEAD`, or a supplied patch |
| The intent | yes | PR title/body, linked issue, or ask: "what is this meant to do?" |
| The base | no | Defaults to the merge base with the current branch's upstream |
| Project rules | no | `CONTRIBUTING.md`, `AGENTS.md`, linter config, test layout |

Without the intent, review the diff for *internal* correctness only and say so
in the first line of the report. Guessing intent produces confident nonsense.

## Procedure

1. **Bound the change.** Run `git diff --stat <base>...HEAD` first. If the diff
   exceeds roughly 800 lines, review it file group by file group and say in the
   report which groups you actually covered. Do not silently truncate.
2. **Read the intent, then read the diff.** Never review a diff you have not
   first decided what the author was trying to achieve.
3. **Check the seams before the code.** For every changed function, find and read
   its callers and the tests that cover it. Most real defects are at the
   boundary: a changed signature with an unupdated caller, a new branch with no
   test, a widened permission with no narrowed test.
4. **Hunt in this order, and stop escalating once you find real bugs:**
   1. **Correctness** — off-by-one, null/undefined, error paths that swallow,
      inverted conditions, races, incorrect await, mutable shared state.
   2. **Security** — unvalidated input reaching a query, authz checks that moved
      or vanished, secrets in code, unsafe deserialization, SSRF, path
      traversal, missing rate limits on new endpoints.
   3. **Compatibility** — breaking API or schema changes, migrations without a
      rollback path, changes to a public type or response shape.
   4. **Regression risk** — a fix with no test, a test that asserts the new
      behaviour but not the old failure, logic moved without its guard.
   5. **Clarity** — only where a reader would genuinely be misled. Not naming,
      not formatting, not comment style.
5. **Verify before reporting.** For every candidate finding, re-read the
   surrounding code and confirm the defect is reachable. Re-read the author's
   own tests: if a test already covers the case, the finding is wrong — drop it.
6. **Rank what survives.** Assign a severity using the rubric below. Delete every
   finding you cannot justify in one sentence of evidence.

Language-specific checklists for JavaScript/TypeScript, Python, Go, and SQL live
in `references/language-checklists.md`. Read it only when the diff touches those
languages; do not load it preemptively.

## Severity rubric

| Severity | Meaning | Examples |
| -------- | ------- | -------- |
| **blocker** | Ships a security hole, data loss, or a crash on a realistic path | SQL injection, auth bypass, lost writes, `undefined` deref on the happy path |
| **major** | Wrong behaviour in a case that will occur | Off-by-one in pagination, unawaited promise hiding a failure, wrong status code |
| **minor** | Correct but fragile or misleading | Duplicated logic that will drift, a test asserting the mock instead of the behaviour, a comment that now lies |
| **nit** | Optional, taste-based | Prefer `const`, rename for clarity |

**Report `minor` and `nit` only when the user asks for a full review.** The
default output is blockers and majors only, plus at most three minors. A review
nobody can act on is a review that gets ignored.

## Output format

Start directly with the findings. No preamble, no restating the PR.

```markdown
## Review

**Verdict:** request changes | approve with comments | approve
**Scope:** 14 files, +380/−92 · covered: all · not covered: none

### block · auth/session.ts:88
Refresh tokens are rotated before the old token is revoked, so a failure
between the two writes locks the user out with no valid token.

**Why it matters:** every user hits this on token expiry during a partial outage.
**Fix:** revoke first, then issue. The existing test at
`auth/session.test.ts:120` covers the happy path only.

### major · api/handlers/search.ts:41
`req.query.limit` is passed to `parseInt` without a radix-free numeric check, so
`?limit=abc` yields `NaN` and the SQL builder falls back to loading every row.

**Why it matters:** unauthenticated input reaches the query layer.
**Fix:** validate with the existing `parseBoundedInt` helper.

### minor · db/migrations/0042_add_index.sql
`CREATE INDEX CONCURRENTLY` cannot run inside a transaction; this migration will
fail on Postgres if the runner wraps statements.
```

Rules for the report:

- Order findings by severity, then by file.
- Every finding names `file:line` and states the concrete failure, not the
  stylistic preference. "Consider extracting this helper" is not a finding.
- If there are no findings, say `No blockers or majors found.` and stop. Do not
  manufacture a nit to look thorough.
- Offer to apply the fixes only after the report, never inline while writing it.

## Guardrails

- **Never claim a defect you have not traced.** No "this might fail", no
  speculative concurrency bugs, no invented call graphs.
- **Never report a finding the existing tests already rule out.** Re-read the
  tests before finalising.
- **Never rewrite the code during a review.** Produce the review; apply changes
  only when asked.
- **Never review secrets, keys, or credential files.** If a diff appears to
  contain one, say so immediately and stop reviewing that file.
- **Never expand scope.** Missing tests, an unrelated design flaw, or a refactor
  you would have done differently are out of scope unless the user asks.
- **Never pad.** Under-reporting a nit is a non-issue; over-reporting destroys
  the signal for the next review.

## Examples

**Input:** "review the last 3 commits on this branch, is it safe to ship?"

**Output:** the report format above, with the commit range as the scope line and
a verdict derived from the highest severity present.

**Why it matters:** "is it safe to ship" is a verdict question. Answering with
findings and no verdict forces the user to interpret severity themselves.

---

**Input:** "any thoughts on my parser rewrite?" (no diff, no branch context)

**Output:**

```markdown
I need the change to review it. Either:

- `git diff main...HEAD` for the branch as a whole, or
- `gh pr diff <n>` for a PR, or
- the patch pasted directly.

Once I have it I'll return ranked findings with file:line references.
```

**Why it matters:** Refusing a boundless review request is correct. Producing
generic advice about parser design is not a review and reads as filler.
