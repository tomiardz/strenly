# Story Template

Copy this template and replace every `<placeholder>` with the appropriate content. Remove sections marked "(when applicable)" if they don't apply. Keep section headings and structure intact — the pipeline depends on consistent formatting.

---

## Summary (ticket title)

```
<Action verb> <what> <where/context>
```

Examples:
- "Add Plan tab to ADW Runs detail view in monitor"
- "Plan Verification Gate — Validate task feasibility before execution"
- "Fix login redirect loop for authenticated users"

---

## Description

### Opening paragraphs

```
<Current state: What exists today and how it works. Name specific components, screens, or flows.>

<Problem or gap: What's missing, broken, or suboptimal. Be specific about the impact.>

<Need: Why this change is necessary now. Connect it to a real pain point or opportunity.>
```

### Business Value

```
- <Benefit 1: Who benefits and how>
- <Benefit 2: What cost, risk, or friction this eliminates>
- <Benefit 3: What capability this unlocks>
```

---

### Acceptance Criteria

```
#### AC1 — <Concern Name>

- Given <precondition>, When <action>, Then <outcome>
- Given <precondition>, When <action>, Then <outcome>

#### AC2 — <Concern Name>

- Given <precondition>, When <action>, Then <outcome>
- Given <precondition>, When <action>, Then <outcome>
- Given <precondition>, When <action>, Then <outcome>

#### AC3 — <Concern Name>

- Given <precondition>, When <action>, Then <outcome>
```

Typical concern groupings (adapt as needed):
- **UI/UX behavior**: Tabs, navigation, visual states, responsive behavior
- **Data flow**: API calls, state persistence, data transformation
- **Error handling**: Invalid input, failed requests, empty states, timeouts
- **Multi-repo behavior**: Per-repo scoping, subtask creation, partial success
- **Integration**: Interaction with existing features, backwards compatibility
- **Lifecycle/states**: State transitions, loading indicators, real-time updates

---

### Non-Functional Requirements (when applicable)

```
- **<Quality attribute>**: <Concrete constraint or expectation>
- **<Quality attribute>**: <Concrete constraint or expectation>
```

Common quality attributes:
- **Performance**, **Reliability**, **Observability**, **Compatibility**, **Security**,
  **Idempotency**, **Concurrency**, **Traceability**

---

### Scope Considerations (when applicable)

```
- <Technical decision or trade-off to evaluate>
- <Existing pattern to extend or reuse>
- <What's explicitly out of scope>
```

---

### Dependencies (when applicable)

```
- <Prerequisite ticket, system, or coordination needed>
```

---

## Sizing Guide

| Story complexity | Expected ACs | AC groups | NFRs | Scope Considerations |
|---|---|---|---|---|
| Small (1-2 files, single concern) | 3-5 | 1-2 | 0-1 | 0 |
| Medium (3-5 files, 2-3 concerns) | 5-10 | 2-4 | 1-3 | 0-2 |
| Large (6+ files, multiple concerns) | 10-20 | 4-7 | 3-6 | 2-4 |

If you find yourself writing more than 20 ACs, the story should probably be split into multiple stories.
