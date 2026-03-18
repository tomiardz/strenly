# Generate README Workflow

1. Determine the mode — check if `--clean` was specified
2. Read the template at [../references/template.md](../references/template.md)
3. Scan the repository using the Context Gathering rules in SKILL.md
4. **Update mode**: read the existing README.md and preserve custom content
5. **Clean mode**: skip the existing README entirely
6. Fill in each template section with verified codebase data (see Section Fill Rules in SKILL.md)
7. Remove all template placeholders — every `{...}` must be replaced with real content
8. Omit sections that have no applicable content rather than leaving them empty
9. Write the final README.md to the repository root
