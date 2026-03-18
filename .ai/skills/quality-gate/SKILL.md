---
name: quality-gate
description: |
  Runs the full quality validation suite (typecheck, lint, tests) and automatically fixes all errors
  until every check passes with zero errors. Use as the final gate before marking work complete or
  creating commits. Unlike test-runner which reports results, this skill loops until everything is green.
  Do NOT load for individual validation tasks or writing new tests.
---

<objective>
Executes the complete quality validation suite and automatically fixes all errors in a loop until every check passes with zero errors. This is the final gate before declaring work complete — it does not stop at reporting, it keeps fixing.
</objective>

<quick_start>
Run the full quality suite and fix until green:

```bash
pnpm quality  # Runs typecheck + lint + test
```

If any check fails:
1. Fix errors immediately (typecheck errors, lint warnings, test failures)
2. Re-run `pnpm quality`
3. Repeat until all three pass with zero errors
4. Report final status with pass counts
</quick_start>

<when_to_use>
Use this skill in these scenarios:

1. **Before marking work complete** — Final validation before telling the user the task is done
2. **Before creating commits** — Ensure all validations pass
3. **User explicitly requests** — When user says "run quality gate", "validate everything", or "check quality"
4. **After parallel story execution** — Final gate after all workstreams complete

Do NOT use for:
- Running individual validations without fixing (use test-runner instead)
- Diagnosing specific test failures (use fix-tests instead)
- Writing new tests
</when_to_use>

<workflow>
1. Run `pnpm quality` (typecheck + lint + test)
2. If typecheck fails: read errors, fix type issues, re-run
3. If lint fails: run `pnpm lint:fix` first, then fix remaining errors manually
4. If tests fail: diagnose root cause, implement minimal fix, verify specific test
5. After all fixes, re-run `pnpm quality` from scratch
6. Repeat until all three pass with zero errors
7. Report final status:
   - TypeCheck: Pass
   - Lint: Pass
   - Tests: Pass (N tests)
</workflow>

<rules>
- NEVER use `as` type casts (Exception: `as const`, `as T` in `Array<T>.includes()`)
- NEVER add workarounds — fix the real issue
- NEVER mark work complete with any failing check
- MUST follow existing project patterns for all fixes
- MUST re-run full suite after fixes to confirm no regressions
</rules>

<success_criteria>
Task is complete when:
- All three validations pass: typecheck, lint, tests
- Zero errors and zero warnings reported
- Changes are ready for commit
</success_criteria>
