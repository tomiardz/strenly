---
name: manage-jira
description: >-
  Jira Cloud integration for interactive terminal use — create, view, edit, search,
  transition, and comment on tickets via acli. Use this skill whenever the user
  asks to create a Jira ticket/story/bug/task, check ticket status, edit or update
  a ticket description, move a ticket to a different status, search for tickets,
  add comments, list subtasks, or any Jira-related operation. Also triggers on mentions of "DASH-", ticket
  keys, or phrases like "create a story", "move to code review", "what's the
  status of", "find tickets", "search jira". Default project is DASH but
  supports any project via "in PROJECT board" syntax.
scope: ["shared"]
---

# Manage Jira

Unified skill for Jira operations via `acli` (Atlassian CLI). All operations go through the CLI wrapper script. Default project is DASH at `dlocal.atlassian.net`.

**This skill is for interactive Claude Code terminal use only.** The SDLC pipeline has its own Jira module at `adws/modules/jira.ts` — this skill does not replace or affect it.

## Prerequisites

`acli` must be installed and authenticated:

```bash
brew tap atlassian/homebrew-acli
brew install acli
acli jira auth login
```

## CLI Wrapper

All operations use:

```bash
bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action <action> [options]
```

Output is always JSON. Check `success` to determine the result.

## Routing

| Intent | What to do |
|--------|------------|
| Create issue with rich content | Read [workflows/create-story.md](workflows/create-story.md) and follow its process |
| View/verify a ticket | `--action verify --ticket KEY` |
| Transition a ticket | `--action transition --ticket KEY --transition "STATUS"` |
| List subtasks | `--action list-subtasks --ticket KEY` |
| Get active sprint | `--action get-active-sprint` (add `--project-key PROJ` for non-DASH) |
| Quick create (no AI content) | `--action create --summary "..."` |
| Search tickets | `--action search --jql "..."` |
| Add a comment | `--action add-comment --ticket KEY --body "..."` |
| Edit ticket description/summary | `--action edit --ticket KEY --description "..." or --description-file PATH` |
| Need ADF formatting help | Read [references/adf-format.md](references/adf-format.md) |
| Need content quality rules | Read [references/content-quality.md](references/content-quality.md) |
| Full action reference | Read [references/cli-wrapper-actions.md](references/cli-wrapper-actions.md) |

## Project Detection

Default project is **DASH**. When the user says "in PROJECT board" or "in PROJECT", use `--project-key PROJECT`. Examples:

- "create a story in CORE board" → `--project-key CORE`
- "search tickets in PAYMENTS" → `--jql "project = PAYMENTS AND ..."`
- "create a bug" → defaults to `--project-key DASH`

## Defaults

- **Project**: DASH
- **Issue type**: Story (valid: Story, Task, Bug, Subtask)
- **Assignee**: @me
- **Jira instance**: `https://dlocal.atlassian.net`

## Valid Statuses for Transitions

- `To Do`
- `In Progress`
- `Code Review`
- `Done`

## Common JQL Patterns

| Goal | JQL |
|------|-----|
| My open tickets | `project = DASH AND assignee = currentUser() AND status != Done` |
| Open bugs | `project = DASH AND issuetype = Bug AND status != Done` |
| Sprint tickets | `project = DASH AND sprint in openSprints()` |
| By status | `project = DASH AND status = "In Progress"` |
| By label | `project = DASH AND labels = "frontend"` |
