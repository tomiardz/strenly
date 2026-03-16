# Content Quality Rules

Guidelines for AI-generated Jira issue content — descriptions, summaries, and acceptance criteria.

## Summary (Title)

- Clear, concise title derived from the request
- Action-oriented: verb + noun (e.g., "Implement user authentication")

## Description

Include:
- **Context and background**: What problem does this solve? Why is it needed?
- **Business value**: What benefit does this provide to users or the business?
- **Technical decisions**: Architecture choices, technology selection, integration patterns
- **Dependencies**: What other systems or components does this interact with?

Exclude:
- Implementation details (no code snippets)
- Step-by-step HOW-TO instructions
- Specific coding patterns

## Acceptance Criteria

- Focus on observable behavior and outcomes
- Make each criterion independently testable
- Cover happy path and key edge cases
- Use Given/When/Then format or bullet points

## Anti-Patterns

### No implementation details in descriptions

- Wrong: "Use React useState hook to manage form state"
- Wrong: "Create a POST /api/auth/login endpoint"
- Right: "Form state management for user inputs"
- Right: "Authentication API endpoint for login requests"

### No vague acceptance criteria

- Wrong: "Feature works correctly"
- Wrong: "User is happy with the result"
- Right: "User can log in with valid credentials"
- Right: "Error message displays for invalid password"

### Always include context (the "why")

- Wrong: "Add login button to homepage"
- Right: "Add login button to homepage to improve discoverability of authentication feature. Currently, users must navigate through menu to find login."
