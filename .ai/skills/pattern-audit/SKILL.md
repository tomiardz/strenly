# Pattern Audit

Architectural pattern audit to run before implementing a story. Takes a story file path as argument.

## Steps

1. Read the story file at the provided path
2. Search the codebase for every existing implementation of similar features:
   - Pagination patterns (contracts, hooks, components)
   - Form patterns (validation, submit, navigation)
   - API endpoint patterns (procedures, use cases, repositories)
   - Schema composition patterns (`.pick()`, `.extend()`, embedding)
   - Batch vs individual API call patterns
3. Document each discovered convention with file paths as evidence
4. Cross-reference these patterns against every task in the story
5. Flag any task where the story's described approach contradicts established conventions
6. Write a brief `patterns-checklist.md` in the story's directory

## Rules

- Do NOT write any implementation code
- Only proceed to coding after the user reviews and approves the checklist
- Include file paths as evidence for every pattern claimed
- Be explicit about contradictions between story and codebase conventions
