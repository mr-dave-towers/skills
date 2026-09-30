# Language checklists

Load this only when the diff actually touches the language in question. Each
section is a list of *recurring* defects, not a style guide.

## JavaScript / TypeScript

- `await` missing on a promise-returning call, or `await` inside a loop where
  `Promise.all` was intended.
- `catch {}` that swallows the error without logging, rethrowing, or recording
  it — the most common silent failure in application code.
- `Array.prototype.map` used for side effects; `forEach` with an `async`
  callback (the promises are not awaited).
- Truthiness checks that treat `0`, `""`, or `false` as absent: prefer an
  explicit `=== undefined` / `!= null` test when zero is a valid value.
- `?.` added without a `??` fallback where the fallback is required, leaving a
  silent `undefined` downstream.
- Optional property or parameter added to an exported function without updating
  callers — TypeScript will not catch it when the function is called through an
  untyped boundary.
- `as` casts that silence a real type mismatch. Check what the cast suppresses.
- Mutable module-level state (`let cache = {}`) shared across requests.
- A type widened to `any` or `unknown` to make an error disappear.
- Missing `await` in a `for` loop that now performs sequential network calls
  inside a request handler.
- Event listener or subscription added in a component/effect with no cleanup in
  the teardown path.

## Python

- Bare `except:` or `except Exception:` that hides the traceback.
- Mutable default argument (`def f(items=[])`) — shared across calls.
- `requests`/`httpx` calls with no timeout.
- A transaction opened without a context manager, or a `commit()` inside a loop
  that should be atomic.
- `.get(k)` on a dict where a `KeyError` was the intended signal.
- N+1 queries: a query inside a loop over ORM objects.
- Logging f-strings (`print(f"...")`) left where structured logging exists.

## Go

- Ignored errors: `err` assigned to `_` on a call that can fail.
- A loop variable captured by a goroutine or closure without rebinding (pre-1.22
  semantics; check the `go` directive in `go.mod`).
- `defer` inside a loop, which stacks until the function returns.
- A mutex copied by value, or a mutex held across a blocking call.
- Missing `context` cancellation or timeout on outbound requests.
- Slice aliasing: appending to a slice that shares a backing array with a
  caller's.

## SQL / migrations

- `CREATE INDEX` without `CONCURRENTLY` on a large table, or `CONCURRENTLY`
  inside a transaction (Postgres rejects both combinations in different ways —
  check the runner).
- A migration that is not reversible, or a destructive `DROP COLUMN` in the
  same deploy that stops writing to it.
- `NOT NULL` added without a default or a backfill, on a table that already has
  rows.
- `SELECT *` persisted into a struct or map that later drives a serialization
  contract.
- A join that changed cardinality without the caller's dedup logic changing.
- Missing index on a new foreign key or a new filter column.
- `DROP INDEX` / `DROP TABLE` that lands before the code stops querying it.
