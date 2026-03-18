---
description: Create a new slash command following best practices
argument-hint: <command-name> [description]
allowed-tools: Read, Write, Bash(mkdir:*)
---

<objective>
Create a new slash command at `.claude/commands/<1>.md` following best practices and XML structure.

This ensures new commands are consistent, well-documented, and follow the established patterns.
</objective>

<process>
1. Parse arguments:
   - Command name: <1>
   - Description: <2> (or infer from command name if not provided)
2. If no arguments provided, ask what kind of command the user wants to create
3. Create command file at `.claude/commands/<1>.md` with:
   - YAML frontmatter (`description`, `argument-hint` if needed, `allowed-tools`)
   - XML-structured body with required tags
4. Include appropriate tags based on command complexity:
   - Always: `<objective>`, `<process>`, `<success_criteria>`
   - If loading state: `<context>` with dynamic commands
   - If creating files: `<output>` and `<verification>`
5. Use minimal tool permissions (prefer read-only when possible)
</process>

<success_criteria>
- Command file created at `.claude/commands/<1>.md`
- YAML frontmatter includes `description`
- Body uses XML structure (not markdown headings)
- Required tags present: `<objective>`, `<process>`, `<success_criteria>`
- Command has focused scope (one job)
</success_criteria>

<output>
File created: `.claude/commands/<1>.md`
</output>

<rules>
- Focused scope: One command = one job
- Descriptive names: Use clear names like `/review-security` not `/rs`
- Tool restrictions: Only allow tools the command actually needs
- Dynamic content: Use `!command` for bash output, `@file` to embed files
- Use `<1>`, `<2>` etc. for positional arguments (not `$1`, `$2`)
</rules>
