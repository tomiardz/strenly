# CLI Wrapper Actions Reference

Script location: `.ai/skills/manage-jira/scripts/jira-cli-wrapper.ts`

```bash
bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action <action> [options]
```

All actions require `acli` to be installed and authenticated. If acli is missing, the wrapper errors with install instructions.

## Available Actions

| Action | Required flags | Optional flags | Purpose |
|---|---|---|---|
| `verify` | `--ticket KEY` | | View ticket details (summary, status, description) |
| `list-subtasks` | `--ticket KEY` | | List all subtasks under a parent ticket |
| `create-subtask` | `--parent KEY`, `--summary "..."` | `--description "..."` | Create a Subtask under a parent |
| `transition` | `--ticket KEY`, `--transition "STATUS"` | | Move a ticket to a new status |
| `get-active-sprint` | | `--project-key PROJ` | Get the active sprint for a project (default: DASH) |
| `create` | `--summary "..."` | `--type TYPE`, `--parent KEY`, `--assignee EMAIL`, `--description "..."`, `--description-file PATH`, `--project-key PROJ` | Create a new issue |
| `search` | `--jql "..."` | `--limit N` | Search tickets via JQL query |
| `add-comment` | `--ticket KEY`, `--body "..."` | | Add a comment to a ticket |
| `edit` | `--ticket KEY` | `--summary "..."`, `--description "..."`, `--description-file PATH` | Edit a ticket's summary or description |

## Defaults

- `--project-key` defaults to `DASH`
- `--type` defaults to `Story` (valid: Story, Task, Bug, Subtask)
- `--assignee` defaults to `@me`
- `--limit` defaults to `20` (for search)

## Output Format

All output is JSON. Check `success` to determine the result.

```json
{
  "success": true,
  "action": "verify",
  "ticket": {
    "key": "DASH-1234",
    "summary": "Implement authentication",
    "status": "In Progress",
    "description": "..."
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Failed to verify ticket: DASH-9999",
  "stderr": "..."
}
```

## Examples

### Verify a ticket

```bash
bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action verify --ticket DASH-567
```

### List subtasks

```bash
bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action list-subtasks --ticket DASH-100
```

### Create a subtask

```bash
bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action create-subtask \
  --parent DASH-100 \
  --summary "Bump ui-lib in dash-core-ui" \
  --description "Update dependency version"
```

### Create an issue

```bash
# Story (default type)
bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action create \
  --summary "Add user preferences page"

# Bug assigned to someone
bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action create \
  --summary "Fix redirect loop on login" \
  --type Bug \
  --assignee john@example.com

# Subtask under a parent
bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action create \
  --summary "Add unit tests for auth module" \
  --type Subtask \
  --parent DASH-456

# Issue in a different project
bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action create \
  --summary "Set up CI pipeline" \
  --project-key OTHER
```

### Transition a ticket

```bash
bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action transition \
  --ticket DASH-567 \
  --transition "Code Review"
```

Non-fatal if the ticket is already in the target status.

### Get active sprint

```bash
bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action get-active-sprint
bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action get-active-sprint --project-key OTHER
```

### Search tickets

```bash
# Find open bugs in DASH
bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action search \
  --jql "project = DASH AND issuetype = Bug AND status != Done" \
  --limit 10

# Find my tickets
bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action search \
  --jql "project = DASH AND assignee = currentUser() AND status != Done"
```

### Add a comment

```bash
bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action add-comment \
  --ticket DASH-567 \
  --body "Implementation complete, ready for review."
```

### Edit a ticket

```bash
# Update description inline
bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action edit \
  --ticket DASH-567 \
  --description "Updated description text"

# Update description from file (recommended for long content)
bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action edit \
  --ticket DASH-567 \
  --description-file /tmp/story.md

# Update summary
bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action edit \
  --ticket DASH-567 \
  --summary "New summary text"
```

## acli Documentation

Full acli reference: `ai_docs/acli-reference.md`
