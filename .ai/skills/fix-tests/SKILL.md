---
name: fix-tests
description: |
  Autonomously diagnoses and fixes test failures by systematically addressing root causes with
  minimal correct fixes following project patterns. Use after test failures occur to fix them
  before marking work complete. Runs validations (test, lint, typecheck) and creates a conventional
  commit. Do NOT load for writing new tests or running quality checks on passing code.
---

<objective>
Autonomously diagnoses and fixes test failures by systematically addressing each failure with minimal correct fixes following project patterns. Iterates per-failure until all pass, then validates the full suite and creates a conventional commit.
</objective>

<quick_start>
1. Run `pnpm test` to identify all failures
2. For each independent failure: diagnose root cause, fix, verify
3. Group related failures if they share a root cause
4. After all pass, run full suite + lint + typecheck
5. Create a single conventional commit listing each fix
</quick_start>

<when_to_use>
Use this skill when:
- Tests are failing and need diagnosis and fixing
- Multiple test failures need systematic resolution
- User explicitly asks to fix failing tests

Do NOT use when:
- All tests are passing (use quality-gate or test-runner instead)
- Writing new tests for new features
- Running validations without known failures
</when_to_use>

<workflow>
1. Run all tests with `pnpm test`, parse every failure
2. For each independent failure:
   - Read the test file and the source file it tests
   - Diagnose the root cause (type mismatch, logic error, missing mock, etc.)
   - Implement the minimal correct fix following existing project patterns
   - Re-run that specific test file to verify: `pnpm test path/to/test.test.ts`
   - Iterate until it passes before moving to the next failure
3. If two failures share a root cause, fix them together
4. After all tests pass, run the full suite to confirm no regressions: `pnpm test`
5. Run lint and typecheck: `pnpm lint && pnpm typecheck`
6. If everything is green, create a single conventional commit with a detailed body listing each fix
</workflow>

<error_handling>
**Circular Failures:**
- If fixing test A breaks test B and fixing B breaks A, group them and analyze the shared dependency
- Consider transaction boundaries, mock state leakage, or shared test fixtures

**Flaky Tests:**
- If a test passes on retry without code changes, investigate timing issues or async state
- Do NOT mark work complete with flaky tests — fix the root cause

**Infrastructure Failures:**
- Database connection errors: check test setup/teardown
- Import errors: run typecheck first to catch build issues
</error_handling>

<rules>
- NEVER use `as` type casts (Exception: `as const`, `as T` in `Array<T>.includes()`)
- NEVER add workarounds — find and fix the real bug
- MUST follow existing project patterns for fixes (search codebase for 2-3 examples)
- MUST implement minimal correct fix only — no refactoring beyond what's needed for tests to pass
- MUST NOT skip or disable tests without user approval
</rules>

<success_criteria>
- All tests pass (`pnpm test` exits 0)
- Lint passes (`pnpm lint` exits 0)
- Typecheck passes (`pnpm typecheck` exits 0)
- Each fix follows existing project patterns (no type casts, no workarounds)
- Single conventional commit created with body listing all fixes
</success_criteria>
