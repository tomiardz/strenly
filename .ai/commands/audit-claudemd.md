---
description: Audit CLAUDE.md files, sync skill references, propagate rules, and maintain skill inventory
allowed-tools: Read, Write, Edit, Glob, Grep, Task, AskUserQuestion
---

<objective>
Audit all CLAUDE.md files in the project for completeness, accuracy, and consistency with:
1. The root CLAUDE.md (source of truth for rules)
2. The actual available skills in `.claude/skills/` (source of truth for skills)

This ensures:
1. **Skill inventory is accurate** - Only existing skills are referenced
2. **Stale skill references are updated** - Renamed/removed skills are fixed everywhere
3. **Rules are propagated** - Root CLAUDE.md rules appear in relevant internal files
4. **No orphaned documentation** - All packages/apps have appropriate CLAUDE.md files
</objective>

<context>
Root CLAUDE.md: @CLAUDE.md

Project structure: !find . -type f -name "package.json" -not -path "*/node_modules/*" | head -20

Existing CLAUDE.md files: !find . -name "CLAUDE.md" -not -path "*/node_modules/*" 2>/dev/null
</context>

<process>

## Phase 1: Parallel Analysis (Launch 3 Subagents)

**CRITICAL**: Launch ALL THREE subagents in a SINGLE message using the Task tool with `subagent_type: claudemd-analyzer`. Run them in parallel for speed.

### Subagent 1: Skill Inventory
```
Mode: skill-inventory

Scan these paths for SKILL.md files:
- .claude/skills/
- ~/.claude/skills/ (user-level skills)

Build complete inventory of all available skills with their descriptions.
Return JSON with mode, skills array, totalCount, and errors.
```

### Subagent 2: Reference Scan (CLAUDE.md files)
```
Mode: reference-scan

Search these paths for skill references (/skill-name patterns):
- ./CLAUDE.md (root)
- All CLAUDE.md files in subdirectories
- .planning/ directory (if exists)

Return JSON with mode, references array, uniqueSkills, and errors.
```

### Subagent 3: Rule Gap Analysis
```
Mode: rule-gap-analysis

For each internal CLAUDE.md file found in the project:
- Compare against root CLAUDE.md rules
- Identify applicable rules that are missing
- Calculate coverage percentage

Root file: ./CLAUDE.md
Internal files: (list each CLAUDE.md in apps/ and packages/)

Return JSON with rules array, summary, and errors.
```

**Wait for all 3 subagents to complete before proceeding.**

## Phase 2: Consolidate Findings

After all subagents complete, consolidate their JSON outputs:

1. **Build skill status map**:
   - Cross-reference inventory (Subagent 1) with references (Subagent 2)
   - Mark each skill as: `active` (referenced), `unused` (exists but not referenced), or `stale` (referenced but doesn't exist)

2. **Build stale reference list**:
   - Skills referenced that don't exist in inventory
   - For each stale reference, find similar skill names that might be replacements

3. **Build rule gap list**:
   - Rules that should be propagated to internal files
   - Group by internal file for efficient updates

4. **Build missing CLAUDE.md list**:
   - Directories with package.json but no CLAUDE.md

## Phase 3: Batch User Questions

Present ALL questions to the user in a SINGLE AskUserQuestion call with multiple questions (max 4 per call). Group questions logically:

**Question Group 1: Stale Reference Resolution**
For each stale reference, ask which replacement to use:
- "Skill `/old-name` is referenced in X files but doesn't exist. Replace with?"
- Options: Similar skills from inventory, "Remove reference", "Skip"

**Question Group 2: Update Scope**
Ask what files to update:
- "Update .planning/ files?" (historical files that may reference old skills)
- "Create missing CLAUDE.md files?" (list directories without CLAUDE.md)

**Question Group 3: Rule Propagation**
For files with low coverage, ask:
- "Propagate X missing rules to Y file?" (show rules and file)

If more than 4 questions needed, use multiple AskUserQuestion calls, but batch as many as possible per call.

## Phase 4: Execute Updates

Based on user answers, execute all updates:

1. **Fix stale references**:
   - Use Edit tool to replace old skill names with approved replacements
   - Update all files where the stale reference appears

2. **Update skill tables in CLAUDE.md files**:
   - Ensure "Relevant Skills" sections list correct skills
   - Remove references to non-existent skills

3. **Propagate rules**:
   - Add missing applicable rules to internal CLAUDE.md files
   - Use "Critical Rules" or similar section

4. **Create missing CLAUDE.md files** (if approved):
   - Use template from this command
   - Include relevant skills for that directory's domain

## Phase 5: Generate Summary Report

Output structured report of all actions taken.

</process>

<success_criteria>
- All 3 analysis subagents completed successfully
- User questions batched (not one-at-a-time)
- All approved updates executed
- Summary report generated
</success_criteria>

<output>
### Analysis Summary (from parallel subagents)

**Skill Inventory**: X skills found
**References Scanned**: Y references across Z files
**Rule Coverage**: Average X% across internal files

### Stale References Resolved
| Old Reference | Resolution | Files Updated |
|---------------|------------|---------------|
| `/old-skill` | → `/new-skill` | file1.md, file2.md |

### Rules Propagated
| Rule | Propagated To |
|------|---------------|
| "Rule text" | packages/backend/CLAUDE.md |

### Files Created
- path/to/new/CLAUDE.md

### Unused Skills (Informational)
Skills that exist but aren't referenced anywhere:
- `/skill-name` - Consider documenting or removing

### Errors Encountered
- (Any errors from subagents or updates)
</output>

## CLAUDE.md Template

When creating new CLAUDE.md files, use this structure:

```markdown
# directory-name/

Brief description of what this directory contains.

## Purpose

Explain the directory's role in the project architecture.

## Structure

```
src/
  relevant-subdirs/
```

## Relevant Skills

| Skill | When to Use |
|-------|-------------|
| `/skill-name` | Description of when to use |

## Conventions

Directory-specific conventions and patterns.

## Critical Rules

- Rules that apply to this directory (from root + local)
```
