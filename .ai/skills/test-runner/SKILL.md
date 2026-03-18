---
name: test-runner
description: |
  Executes sequential code quality validations (TypeScript type checking, linting, tests) and reports
  results with suggested fixes. Use after completing tasks or before declaring a feature complete.
  Triggers when code changes are done and validation is needed before committing or marking work complete.
  Do NOT load for writing tests or debugging test failures.
---

<objective>
Executes code quality validations sequentially to ensure code meets project standards before declaring work complete. Runs TypeScript type checking, linting, and tests, then provides actionable error messages and fix suggestions.
</objective>

<quick_start>
Run validations sequentially:

```bash
# 1. TypeScript Type Checking
pnpm typecheck

# 2. Linting
pnpm lint

# 3. Tests
pnpm test --run
```

Each validation runs sequentially. If one fails, continue to run the others to provide complete feedback.
</quick_start>

<when_to_use>
Use this skill proactively in these scenarios:

1. **After completing a task** - Before marking a task as completed, validate the code changes
2. **Before declaring a feature complete** - Ensure all quality checks pass before telling the user the work is done
3. **After writing significant code** - After implementing a use case, repository, component, or any substantial code change
4. **Before creating a commit** - Validate code quality before running the commit command
5. **When user requests validation** - When user explicitly asks to "run tests" or "validate code"

**Important**: This skill should be used automatically and proactively. Do NOT ask the user permission to run validations - just run them when appropriate.
</when_to_use>

<validation_details>
**1. TypeScript Type Checking** (`pnpm typecheck`)
- Verifies type correctness across the codebase
- Catches type mismatches, missing imports, and type errors
- Fails if any TypeScript compilation errors exist

**2. Linting** (`pnpm lint`)
- Checks code style and quality rules
- Identifies unused variables, formatting issues, and code smells
- Fails if any lint errors exist (warnings may be allowed)

**3. Tests** (`pnpm test --run`)
- Runs unit and integration tests
- Skips if no test files found
- Fails if any test cases fail
</validation_details>

<responding_to_results>
**When All Checks Pass:**

```
All code quality checks passed:
- TypeCheck: Pass
- Lint: Pass
- Tests: Pass (12 tests)

The feature is complete and ready for commit.
```

**When Checks Fail:**

1. **Show the relevant errors** to the user
2. **Identify the root cause** by reading the affected files
3. **Fix the errors** using appropriate tools
4. **Re-run validations** after fixes to confirm resolution
5. **Repeat until all checks pass**

Example workflow:

```
Validation failed - 3 lint errors found:
- src/components/Button.tsx:10 - Unexpected unused variable 'handleClick'
- src/components/Button.tsx:15 - Missing semicolon

Let me fix these issues:

1. Removing unused variable 'handleClick' from Button.tsx:10
2. Running 'pnpm lint --fix' to fix formatting issues

Re-running validations...
All checks passed!
```
</responding_to_results>

<common_fix_patterns>
**TypeScript Errors:**
- Missing imports → Add import statements
- Type mismatches → Update types (avoid `as` casting per project rules)
- Unused variables → Remove or prefix with `_` if intentionally unused

**Lint Errors:**
- Always try `pnpm lint --fix` first (auto-fixes most formatting issues)
- If errors remain, manually fix in code

**Test Failures:**
- Read test file to understand expectations
- Fix implementation logic or update tests if requirements changed
- Never skip or disable tests without user approval
</common_fix_patterns>

<suggested_fixes_reference>
| Error Pattern | Suggested Fix |
|---------------|---------------|
| "cannot find name", "not found" | Missing import detected. Review imports in affected files. |
| Type mismatch, not assignable | Type mismatch detected. Verify types match expected signatures. |
| Unused variables/imports | Unused variables/imports detected. Remove or prefix with underscore if intentionally unused. |
| Lint errors | Run 'pnpm lint --fix' to automatically fix formatting issues. |
| Test assertions failing | Test assertions failing. Review test expectations vs actual behavior. |
| General test failures | Tests failing. Review test output and fix failing test cases. |
</suggested_fixes_reference>

<todo_integration>
When working with tasks:

1. **Before marking a task as completed**, run validations
2. **If validations fail**, keep task as `in_progress` and fix errors
3. **Only mark task as completed** after validations pass

```typescript
// BAD - Marking complete without validation
TodoWrite: [{ content: "Implement user authentication", status: "completed" }]

// GOOD - Validate before marking complete
1. Implement user authentication code
2. Run test-runner skill
3. Fix any validation errors
4. TodoWrite: [{ content: "Implement user authentication", status: "completed" }]
```
</todo_integration>

<important_notes>
- **Always run validations proactively** - Don't ask user permission
- **Fix errors immediately** - Don't declare work complete with failing validations
- **Show user the results** - Copy relevant parts of the output in your response
- **Re-validate after fixes** - Always re-run after fixing errors
- **Integration with project** - This skill respects project conventions (no type casting with `as`, no non-null assertions with `!`)
</important_notes>

<success_criteria>
Key principles:
- Run automatically after completing tasks
- Fix all errors before marking work complete
- Show users clear, actionable error messages
- Re-validate after fixes to confirm resolution
- Integrate with task workflow for quality gates
</success_criteria>
