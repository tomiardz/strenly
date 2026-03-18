---
name: parallel-story
description: |
  Executes a story using parallel agents for independent workstreams. Orchestrates sub-task agents,
  runs quality gates, performs code review, and creates logical conventional commits. Takes a story
  file path as argument. Use when implementing stories with multiple independent tasks that can
  execute concurrently. Do NOT load for sequential workflows or single-task stories.
---

<objective>
Orchestrates parallel execution of story tasks using sub-agents for independent workstreams. Groups tasks by file affinity, spawns concurrent agents, validates quality, reviews code, and creates logical conventional commits grouped by feature area.
</objective>

<quick_start>
Provide a story file path as argument. The skill will:
1. Read the story file and identify all tasks
2. Group tasks into independent workstreams (no shared files)
3. Spawn parallel sub-agents for each workstream
4. Run full quality gate after all complete
5. Create logical commits grouped by feature area
</quick_start>

<when_to_use>
Use this skill when:
- Story has 3+ tasks with clear file boundaries
- Tasks can be grouped into independent workstreams (no shared files)
- Full quality gate required after implementation

Do NOT use when:
- Story has fewer than 3 tasks (execute sequentially instead)
- Tasks have strong interdependencies requiring sequential execution
- Tasks touch the same files (risk of conflicts between agents)
</when_to_use>

<workflow>
1. Read the story file at the provided path and identify all tasks
2. Group tasks into independent workstreams:
   - Extract file paths each task will touch
   - Tasks with NO overlapping paths go into separate workstreams
   - Tasks with shared paths or dependencies go into the same workstream
3. For each workstream, create a sub-task agent that:
   - Implements all tasks in that group following project patterns in CLAUDE.md
   - Writes tests for each new file
   - Runs typecheck + lint on changed files
4. After all sub-tasks complete, run the full test suite (`pnpm test`)
5. If any tests fail, diagnose and fix them
6. Execute a full code review:
   - Check for unused imports
   - Type safety (no `as` casts)
   - Proper error handling with neverthrow
   - Consistent patterns with existing code
   - Test coverage for edge cases
7. Fix any issues found in review and re-run all tests
8. When everything is green with 0 lint warnings, create logical conventional commits grouped by feature area
9. Update the story file marking all tasks complete
</workflow>

<error_handling>
**Sub-agent Failures:**
- If a sub-agent fails, diagnose the error before continuing with others
- Fix the failure and restart that specific workstream
- Do not proceed to quality gate until ALL workstreams complete successfully

**Merge Conflicts:**
- If workstreams touch overlapping files despite grouping, pause parallel execution
- Resolve conflicts manually before continuing
- Re-group tasks if conflicts indicate poor initial grouping

**Quality Gate Failures:**
- Run full diagnostic on all changed files
- Fix all errors before creating commits
- Re-run full quality gate to confirm resolution
</error_handling>

<rules>
- NEVER use `as` type casts (Exception: `as const`, `as T` in `Array<T>.includes()`)
- NEVER add workarounds — follow established patterns
- MUST group commits by feature area, not by workstream
- MUST NOT mark complete until full quality gate passes (tests + lint + typecheck)
- MUST update story file with task completion status
</rules>

<success_criteria>
- All story tasks completed and implemented
- All tests passing (`pnpm test` exits 0)
- No lint errors (`pnpm lint` exits 0)
- No type errors (`pnpm typecheck` exits 0)
- Logical conventional commits created grouped by feature area
- Story file updated with all tasks marked complete
</success_criteria>
