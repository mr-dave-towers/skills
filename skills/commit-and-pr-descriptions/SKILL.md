---
name: commit-and-pr-descriptions
description: Use when writing a git commit message, a pull request title and body, or a changelog entry from real work. Triggers on "write a commit message", "commit this", "open a PR", "write a PR description", "summarise these changes for release notes".
license: MIT
compatibility: opencode, claude-code, codex
metadata:
  author: "@mr-dave-towers"
  version: 1.0.0
---

# Commit And PR Descriptions

Derive the message from the actual diff, never from the conversation. The author
knows what they meant; only the diff records what shipped.

## When to use this

Use it when the user wants a commit message, a PR title and body, or a changelog
entry for work that already exists as changes.

Do not use it for:

- **Writing the code.** This skill describes a diff; it does not produce one.
- **Reverting or cherry-picking history.** That is a git operation, not a
  writing task.
- **Release notes from a merge base spanning many releases.** Use the
  `changelog-entry` shape below per release, not once per quarter.

## Inputs

| Input | Required | How to obtain it |
| ----- | -------- | ---------------- |
| The change | yes | `git diff`, `git diff --staged`, `git diff <base>...HEAD`, or `gh pr diff` |
| Scope | yes | The single subject area: `auth`, `api`, `parser`, `ui` |
| Audience | no | Defaults to the team's conventions. Read `CONTRIBUTING.md`, `AGENTS.md`, or recent `git log` for the house style. |
| Issue key | no | Branch name (`feat/ENG-123-…`) or user input. Omit the trailer if absent. |

If no diff exists — nothing staged, nothing committed since the base — say so
and stop. Do not invent a description for work that was never written.

## Procedure

1. **Read the diff, then the log.** `git diff <base>...HEAD` for the substance;
   `git log --oneline -20` to learn the repo's actual commit style. Match the
   repo, not the Conventional Commits spec.
2. **Write the subject first, in isolation.** One line, under 72 characters, no
   trailing period, imperative mood ("add", not "added" or "adds"). It must be
   meaningful with the diff hidden.
3. **Write the body only if the change is not self-evident from the subject.**
   A body explains *why*, never *what* — the diff already shows what. Two to
   eight lines. If a body adds nothing over the subject, omit it.
4. **Group by logical change, not by file count.** If the diff contains two
   independent behaviours, propose two commits and show both messages. Do not
   produce a single message that says "misc changes".
5. **Add trailers only when the info exists.** `Breaks-change:`, `Refs: ENG-123`,
   `Co-authored-by:`. Never invent an issue key, a reviewer, or a ticket number
   to fill the convention.
6. **Sanity-check the diff against the message.** Re-read the diff. Every hunk
   should be accounted for by the subject or the body. If a hunk is
   unrepresented — an unrelated drive-by change, a stray debug statement — call
   it out and recommend splitting it out rather than describing it as intended.

## Output format

### Commit

```text
fix(auth): reject refresh tokens issued before a password change

The old check compared only iat, so a token minted minutes before the
password change still refreshed successfully for its full 30-day life.

Adds an `pwd_changed_at` comparison to the refresh path and a regression
test covering the window.

Refs: ENG-482
```

Rules: subject, blank line, body, blank line, trailers. No bullet lists in the
body — prose, wrapped at 72 characters.

### Pull request

```markdown
**Title**

fix(auth): reject refresh tokens issued before a password change

Follows the schema: <type>(<scope>): <imperative subject>

## Summary

One paragraph: what changed and why it mattered. Written for someone who has
not read the issue. Three sentences maximum.

## Changes

- Added a `pwd_changed_at` comparison to the refresh token path
- Added a regression test for tokens minted inside the change window
- No migration required; the column is nullable and backfilled lazily

## Testing

State what was actually run: `npm test`, `npm run check`, plus anything manual.
If something was not run, say so explicitly.

## Risk

Blast radius and rollback. Name the revert target (commit, migration, flag).
```

Rules: the title is the commit subject, unchanged. The body answers *why*, *what
changed as a list*, *how it was tested*, and *how to undo it*. Drop the Risk
section only for docs-only changes; keep it for anything touching data, auth, or
the public API.

### Changelog entry

One line per change, grouped under the release type, written for users rather
than developers:

```markdown
### Fixed

- Refresh tokens issued before a password change are now rejected (#482).
```

### Split proposal

When the diff is not one logical change, lead with the split, then each message:

```markdown
This diff contains two independent changes. Recommend two commits:

**1.** `refactor(auth): extract token minting into a single helper`
   Covers: src/auth/tokens.ts, src/auth/login.ts, src/auth/refresh.ts

**2.** `fix(ui): keep the error banner mounted during retry`
   Covers: src/ui/LoginForm.tsx
```

## Guardrails

- **Never describe a change that is not in the diff.** No planned work, no
  "also fixes" that the diff does not contain.
- **Never write a commit message from the user's prose alone.** Diff first.
- **Never exceed 72 characters on the subject**, and never end it with a period.
- **Never add trailers with invented values.** No issue key that was not in the
  branch name or the user's message.
- **Never run `git commit`, `git push`, or `gh pr create` from this skill.**
  Output the text; let the user run the command. This skill writes, it does not
  publish.
- **Never describe lockfile or formatting churn as a change.** If the diff is
  almost entirely a lockfile bump, say that and recommend committing it
  separately.
- **Never hide a drive-by change in the description.** Split it out or flag it.

## Examples

**Input:** "write a commit message for what's staged"

**Output:** the commit format above, derived from `git diff --staged`. If
nothing is staged, respond with the exact command to inspect it rather than a
guess.

**Why it matters:** The most common failure is describing what the user
discussed rather than what is staged. Those diverge constantly.

---

**Input:** "open a PR for this branch"

**Output:** the pull request format, then a single closing line:

```text
Run: git push -u origin <branch> && gh pr create --title "<title>" --body-file pr.md
```

Write the body to a file rather than a heredoc so the shell does not mangle it.
Do not run the command yourself.
