# ADF (Atlassian Document Format) Reference

Jira Cloud uses **ADF JSON** for all rich text fields. Plain text and Jira Wiki Markup (`*bold*`, `h2.`) are NOT rendered as styled content -- they appear as raw characters.

## Root Structure

Every description must be a valid ADF document:

```json
{
  "version": 1,
  "type": "doc",
  "content": [ ...block nodes... ]
}
```

## Block Nodes

Direct children of `content`:

| Element | ADF structure |
|---|---|
| Paragraph | `{ "type": "paragraph", "content": [...inline...] }` |
| Heading H2 | `{ "type": "heading", "attrs": { "level": 2 }, "content": [...inline...] }` |
| Heading H3 | `{ "type": "heading", "attrs": { "level": 3 }, "content": [...inline...] }` |
| Bullet list | `{ "type": "bulletList", "content": [...listItem...] }` |
| Ordered list | `{ "type": "orderedList", "content": [...listItem...] }` |
| List item | `{ "type": "listItem", "content": [ { "type": "paragraph", "content": [...inline...] } ] }` |
| Divider | `{ "type": "rule" }` |

## Inline Nodes

Inside paragraph / heading `content`:

| Element | ADF structure |
|---|---|
| Plain text | `{ "type": "text", "text": "Hello world" }` |
| Bold | `{ "type": "text", "text": "bold", "marks": [{ "type": "strong" }] }` |
| Italic | `{ "type": "text", "text": "italic", "marks": [{ "type": "em" }] }` |
| Link | `{ "type": "text", "text": "label", "marks": [{ "type": "link", "attrs": { "href": "https://..." } }] }` |
| Inline code | `{ "type": "text", "text": "code", "marks": [{ "type": "code" }] }` |

## Recommended Description Layout

Use this section layout for every story:

```
[intro paragraph -- context + problem statement]

H2: Business Value
[paragraph]

--- rule ---

H2: Acceptance Criteria
[bulletList]
```

Add extra H2/H3 sections (e.g., "Component", "Dependencies") as needed.

## Full ADF Example

```json
{
  "version": 1,
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Context paragraph explaining the problem." }
      ]
    },
    {
      "type": "heading",
      "attrs": { "level": 2 },
      "content": [{ "type": "text", "text": "Business Value" }]
    },
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Why this matters to users and the business." }
      ]
    },
    { "type": "rule" },
    {
      "type": "heading",
      "attrs": { "level": 2 },
      "content": [{ "type": "text", "text": "Acceptance Criteria" }]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "First criterion" }] }]
        },
        {
          "type": "listItem",
          "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Second criterion" }] }]
        }
      ]
    }
  ]
}
```

## Anti-Patterns -- NEVER Use These

| Wrong | Correct |
|---|---|
| `*Business Value*` | `{ "type": "heading", "attrs": { "level": 2 }, ... }` |
| `h2. Acceptance Criteria` | `{ "type": "heading", "attrs": { "level": 2 }, ... }` |
| `- bullet item` | `{ "type": "bulletList", "content": [...] }` |
| `----` | `{ "type": "rule" }` |
| Passing plain text to `--description` flag | Write ADF JSON to a file, use `--from-json` |
| Jira Wiki Markup (`*bold*`, `h2.`) | ADF JSON -- Wiki Markup is Jira Server/DC only, not Cloud |
