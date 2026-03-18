---
name: write-user-story
description: >
  Craft well-structured user stories with Gherkin acceptance criteria, business context, and technical
  decisions — optimized for consumption by the ADW SDLC/MSDLC pipeline. Use this skill whenever creating
  Jira stories, writing feature descriptions, drafting acceptance criteria, or when the user mentions
  "user story", "story", "acceptance criteria", "gherkin", or asks to describe a feature for the pipeline.
  Also use when the user provides a feature idea and needs it turned into a structured, plannable story.
  This skill defines WHAT goes into a story and WHY — for the mechanics of creating Jira tickets (ADF
  formatting, CLI commands, transitions), defer to the manage-jira skill.
scope: ["shared"]
---

# Write User Story

A story is the primary input to the ADW autonomous development pipeline. The planner reads the story description as-is, extracts acceptance criteria into the plan, and the reviewer later verifies each criterion against the implementation. In multi-repo (MSDLC) scenarios, the description is also used to generate scoped subtask descriptions per repository. This means the quality and structure of the story directly determines the quality of the plan, the implementation, and the review.

The goal of a story is to communicate **what** needs to happen and **why**, with enough context for an autonomous agent to understand scope, constraints, and success criteria — without prescribing **how** to implement it.

## Story Structure

Every story follows this structure. Read [references/story-template.md](references/story-template.md) for the fill-in template.

### 1. Context Paragraphs (the opening)

Two to three paragraphs that set the stage:

- **Current state**: What exists today and how it works
- **Problem or gap**: What's missing, broken, or suboptimal
- **Need**: Why this change is necessary now

These paragraphs should give a reader (or an agent) enough background to understand the domain without prior knowledge of the feature area. Avoid jargon that isn't explained. Be specific — name the components, screens, or flows involved.

**Why this matters to the pipeline:** `buildPromptFromTicket()` sends `summary + description` directly to the planner. These opening paragraphs are the planner's first impression and primary context for feasibility evaluation. Vague openings lead to vague plans.

### 2. Business Value

A short section (heading + bullet list) explaining the tangible benefits:

- Who benefits and how (users, developers, the team, the business)
- What cost, risk, or friction this eliminates
- What capability this unlocks

Keep each bullet to one clear benefit. Avoid restating the problem — focus on the positive outcome.

### 3. Acceptance Criteria (Gherkin format)

This is the most critical section. The planner extracts these into the plan's `Acceptance Criteria` section, and the reviewer checks each one against the implementation.

**Group criteria by concern** using numbered subheadings: `AC1 — <Concern Name>`, `AC2 — <Concern Name>`, etc. Each group contains one or more Gherkin bullets.

**Gherkin format for each criterion:**

```
Given <precondition/context>,
When <action or event>,
Then <observable outcome>
```

**Rules for writing good acceptance criteria:**

- **Observable and testable**: Every criterion must describe something a reviewer can verify by looking at the code, running the app, or checking state. "The system handles errors gracefully" is not testable. "Given an API call fails, When the error is caught, Then a user-facing message is displayed with the error reason" is.
- **One behavior per bullet**: Don't combine multiple outcomes. Split them.
- **Cover the happy path AND key edge cases**: Think about what happens when things go wrong, when inputs are missing, when the feature is used in unexpected ways.
- **No implementation details**: Don't say "use a React hook" or "add a column to the database". Describe the behavior, not the mechanism.
- **Scope to the right level**: Each AC group should be a logical concern (e.g., "New UI tab", "API validation", "State persistence", "Multi-repo behavior").

**Why grouping matters:** In MSDLC, the subtask generator reads the full description to produce scoped Gherkin descriptions per repository. Well-grouped ACs make it easy to assign the right criteria to the right repo. Flat, ungrouped lists lead to confused subtask scoping.

### 4. Non-Functional Requirements (when applicable)

A bullet list of cross-cutting concerns that constrain HOW the feature should behave (but still not how to implement it):

- **Performance**: Response time expectations, concurrency requirements
- **Reliability**: Idempotency, crash recovery, partial failure handling
- **Observability**: What should be logged, tracked, or visible in the monitor
- **Compatibility**: Backwards compatibility, migration needs, state consistency
- **Security**: Auth requirements, input validation boundaries

Only include NFRs that are genuinely relevant. Don't pad with generic items. Each NFR should name the quality attribute in bold followed by a concrete constraint.

**Why this matters to the pipeline:** The planner uses NFRs to add constraints to implementation tasks. The reviewer checks them alongside ACs. Missing NFRs for critical concerns (like idempotency in a pipeline that can be interrupted) lead to bugs discovered only in production.

### 5. Scope Considerations (when applicable)

Technical decisions and architectural questions that shape the implementation without dictating it:

- Trade-offs to evaluate (e.g., "Evaluate whether a dedicated agent is justified or if adjusting existing prompts suffices")
- Existing patterns to extend (e.g., "The `planValid` field already exists for vuln and bump — extend this pattern to all issue classes")
- Boundaries of what's in and out of scope
- Dependencies on other systems, features, or prerequisites

This section bridges the gap between "what" and "how" — it provides directional guidance without step-by-step instructions. Think of it as the technical decisions the product owner and architect agree on before handing off to the team.

### 6. Dependencies (when applicable)

External systems, features, or prerequisites that must exist or be coordinated with:

- Other tickets that must be completed first
- External APIs or services involved
- Configuration or infrastructure changes needed
- Cross-team coordination required

## Writing Quality Checklist

Before finalizing a story, verify:

- [ ] **Summary is action-oriented**: verb + noun (e.g., "Add Plan tab to ADW Runs detail view")
- [ ] **Context paragraphs explain the problem without assuming prior knowledge**
- [ ] **Business value states benefits, not features**
- [ ] **Every AC is independently testable** with Given/When/Then
- [ ] **ACs are grouped by concern**, not listed flat
- [ ] **No implementation details** in ACs (no code patterns, no file paths, no API endpoints)
- [ ] **Edge cases are covered** (empty states, error states, concurrent access, missing data)
- [ ] **NFRs name the quality attribute** and give a concrete constraint
- [ ] **Scope considerations provide direction** without dictating implementation
- [ ] **The story could be understood by someone unfamiliar** with the feature area

## Anti-Patterns

| Anti-Pattern | Why it's bad | Better approach |
|---|---|---|
| "Use useState to manage X" | Implementation detail in AC | "The state is preserved across tab switches" |
| "Add endpoint POST /api/foo" | Prescribes the how | "The feature exposes an API for creating foo resources" |
| "Feature works correctly" | Not testable | Specific Given/When/Then for each behavior |
| Flat list of 15 ACs | Hard to scope for MSDLC, hard to review | Group by concern with AC1, AC2, AC3... |
| "User is happy" | Subjective, untestable | "User can complete the flow in under 3 clicks" |
| Mixing concerns in one AC | Can't verify independently | Split into separate bullets |
| No error/edge cases | Planner won't plan for them, reviewer won't check them | Add ACs for empty states, failures, invalid input |
| Repeating the problem in Business Value | Redundant, wastes context | Business Value focuses on positive outcomes |

## Language

Stories can be written in English or Spanish — follow the language the user is using. Gherkin keywords (Given/When/Then) stay in English regardless, as they're part of the format specification. The rest of the content (descriptions, criteria text, NFRs) should match the user's language.

## Relationship to Other Skills

- **manage-jira**: Handles Jira mechanics (ADF formatting, CLI commands, ticket creation, transitions). After writing the story content using this skill, use manage-jira to create the actual ticket.
- **create-dcoder-tickets**: For automated pipeline tickets (bumps, vulns, custom tasks). Uses a different template optimized for dCoder agents.
- **generate-subtasks**: Consumes the story description to produce per-repo Gherkin subtasks in MSDLC. Well-structured stories with grouped ACs produce better subtask scoping.
