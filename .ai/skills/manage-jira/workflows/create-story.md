# Create Story Workflow

AI-assisted creation of Jira issues with structured descriptions, acceptance criteria, and proper ADF formatting for Jira Cloud.

## Required Reading

Before following this workflow, read:
- [../references/adf-format.md](../references/adf-format.md) for ADF formatting rules
- [../references/content-quality.md](../references/content-quality.md) for description and acceptance criteria guidelines

## Step 1: Parse Input Arguments

Extract components from the user's input:

- **Description**: The main story description (everything not matching patterns below)
- **Issue type**: Detect "as task", "as bug", or "as story" (default: Story if not specified)
- **Parent issue**: Detect "as subtask of KEY-XXX" pattern
- **Custom assignee**: Detect "assign to [name/email]" pattern
- **Project**: Detect "in PROJECT board" or "in PROJECT" pattern (default: DASH)

### Argument Patterns

| Pattern | Result |
|---|---|
| `as task` | Type = Task |
| `as bug` | Type = Bug |
| `as story` | Type = Story (also the default) |
| `as subtask of DASH-123` | Creates issue as subtask with `"parentIssueId": "DASH-123"` in JSON |
| `assign to john@example.com` | Use that email as `"assignee"` in JSON |
| `assign to John Smith` | Search by display name |
| (no assignee specified) | Resolve via `git config user.email` |
| `in PROJ board` or `in PROJ` | Use PROJ as `"projectKey"` in JSON |
| (no project specified) | Default to DASH |

## Step 2: Generate Story Content

Create well-structured content following [../references/content-quality.md](../references/content-quality.md). Generate a summary (title), description, and acceptance criteria.

## Step 3: Create the Jira Issue

**MANDATORY: Descriptions MUST use ADF JSON.** Do NOT pass plain text via `--description`. Do NOT use Jira Wiki Markup (`*bold*`, `h2.`) -- that syntax only works in Jira Server/DC, not Jira Cloud. See [../references/adf-format.md](../references/adf-format.md) for the full ADF reference.

### 3a. Resolve the assignee email

```bash
# Default: resolve current user's email from acli auth status (the actual Jira account)
ASSIGNEE_EMAIL=$(acli jira auth status 2>&1 | grep 'Email:' | awk '{print $2}')

# Custom assignee (if "assign to X" was specified): use that email directly
ASSIGNEE_EMAIL="user@example.com"
```

**Important:** Always use `acli jira auth status` to resolve the default assignee email — do NOT use `git config user.email`, which may not match the Jira account.

### 3b. Build the work item JSON with ADF description

Write the complete work item as a JSON file to `/tmp/jira-issue-$RANDOM.json`:

```json
{
  "projectKey": "DASH",
  "summary": "<generated summary>",
  "type": "<Story|Task|Bug|Subtask>",
  "assignee": "<resolved email from step 3a>",
  "description": {
    "version": 1,
    "type": "doc",
    "content": [
      ...ADF nodes...
    ]
  }
}
```

**JSON field rules:**
- **Always include `"assignee"` in the JSON** using the email resolved in step 3a. The `--assignee` CLI flag is unreliable when `--from-json` is used -- the JSON fields take precedence.
- Subtask (detected "as subtask of KEY-XXX"): add `"parentIssueId": "KEY-XXX"`
- Project override (detected "in PROJ"): use `"projectKey": "PROJ"`
- Omit fields not needed (e.g., omit `parentIssueId` for root-level issues)

### 3c. Run acli with the temp file

```bash
acli jira workitem create --from-json /tmp/jira-issue-<N>.json
```

Do **NOT** add `--json` -- it produces no output on success, making it impossible to extract the issue key and risking silent failures or duplicates.

Parse the human-readable output to extract the issue key. The success line looks like:
```
Work item DASH-123 created: https://dlocal.atlassian.net/browse/DASH-123
```

Extract the key with: `grep -oE '[A-Z]+-[0-9]+'`

Delete the temp file after success.

## Step 4: Return Result

Provide the user with:
- Created issue key (e.g., DASH-123)
- Direct URL to the issue: `https://dlocal.atlassian.net/browse/DASH-123`
- Brief confirmation message

## Examples

### Example 1: Basic story

**Input:** `Implement user authentication`

- **Summary**: Implement user authentication
- **ADF description**: intro paragraph + H2 "Business Value" + rule + H2 "Acceptance Criteria" with bulletList
- **Acceptance Criteria**: Users can register, login, see errors for invalid credentials, JWT expiry, password reset

### Example 2: Bug

**Input:** `Fix login redirect bug as bug`

- **Summary**: Fix login redirect loop on authenticated users
- **Type**: Bug
- **ADF description**: intro (what's broken, who's affected) + H2 "Impact" + rule + H2 "Acceptance Criteria"

### Example 3: Subtask

**Input:** `Add analytics dashboard widget as subtask of DASH-456`

- **Summary**: Add analytics dashboard widget
- **Type**: Subtask
- **JSON includes**: `"parentIssueId": "DASH-456"`
- **ADF description**: intro (what this widget does, why it belongs to parent) + H2 "Business Value" + rule + H2 "Acceptance Criteria"

### Example 4: Issue in another project

**Input:** `Set up CI pipeline in CORE board`

- **Summary**: Set up CI pipeline
- **Project**: CORE
- **ADF description**: intro + H2 "Business Value" + rule + H2 "Acceptance Criteria"

## Success Criteria

A successfully created story has:
- Valid issue key returned (e.g., DASH-123)
- Correct issue type (Story, Task, Bug, or Subtask)
- Clear, action-oriented summary
- Description rendered with proper headings, bullet lists, and dividers in Jira (not raw markup)
- Detailed description with context, business value, technical decisions, NO implementation details
- Testable acceptance criteria as a bulletList in ADF
- Correct assignee (current user or specified user)
- Parent relationship established if specified
- Correct project (DASH by default, or specified project)
- Accessible URL provided to user
