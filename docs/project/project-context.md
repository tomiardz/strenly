---
project_name: 'Strenly'
user_name: 'Tomi'
date: '2026-02-17'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow', 'critical_rules']
status: 'complete'
rule_count: 67
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | LTS |
| Package manager | pnpm workspaces | 9.15.4 |
| Build orchestrator | Turbo | 2.5.4 |
| Language | TypeScript (strict) | 5.7.3 |
| Linting/Formatting | Biome | 2.3.12 |
| Frontend framework | React | 19 |
| Bundler | Vite | — |
| Routing | TanStack Router (file-based) | — |
| Server state | TanStack Query | — |
| UI primitives | Base UI + shadcn/ui + Tailwind CSS | @base-ui/react 1.0.0 |
| Complex state | Zustand | — |
| API framework | Hono | — |
| RPC | oRPC (RPCLink) | — |
| Database | Neon PostgreSQL + Drizzle ORM | — |
| Auth | Better-Auth (organization plugin) | — |
| Validation | Zod 4 | — |
| Error handling | neverthrow (ResultAsync) | — |
| Unit tests | Vitest | — |
| E2E tests | Playwright | — |

**Critical constraint:** Zero Radix UI dependencies — project uses Base UI exclusively.

## Critical Implementation Rules

### TypeScript Rules

- **No `as` casting** — fix the actual type. Exceptions: `as const`, `as T` in `Array<T>.includes(value as T)`, test files only.
- **No `!` non-null assertions** — use `?.` or `??` instead.
- **No `any`** — use `unknown` and narrow with type guards or Zod schemas. For scope-specific validation without business logic, the Zod schema can be local (not in `@strenly/contracts`). Business-logic schemas always from contracts.
- **No barrel files** (`index.ts` re-exports). Allowed exceptions: `procedures/router.ts`, `procedures/{domain}/index.ts`, `infrastructure/repositories/index.ts`, `database/src/schema/index.ts`, package-level `index.ts` entry points.
- **All modules are ESM** — `"type": "module"` at root.
- **Import aliases**: `@/` maps to `src/` in frontend apps (Vite + Vitest). Cross-package imports use `@strenly/{package}` with subpath exports.
- **Biome import ordering**: npm packages → package protocol → absolute paths → relative paths. Biome auto-sorts; never manually reorder.
- **Never define Zod schemas inline for business logic** — always import from `@strenly/contracts/{domain}/{entity}`.

### Error Handling by Layer

| Layer | Return type | Error naming |
|---|---|---|
| Domain (core) | `Result<T, DomainError>` | `UPPER_SNAKE_CASE` (`INVALID_NAME`, `INVALID_EMAIL`) |
| Ports (core) | `ResultAsync<T, RepositoryError>` | `DATABASE_ERROR` |
| Repositories (backend) | `ResultAsync<T, RepositoryError>` | Wraps Drizzle errors via `wrapDbError` |
| Use cases (backend) | `ResultAsync<T, UseCaseError>` | `lowercase_snake` (`forbidden`, `validation_error`, `repository_error`) |
| Procedures (backend) | Throws oRPC errors | `FORBIDDEN`, `NOT_FOUND`, `UNAUTHORIZED` |
| Frontend mutations | `handleMutationError()` | `UNAUTHORIZED` → redirect, others → toast |

- **Never throw in domain, ports, repos, or use cases** — always return `Result`/`ResultAsync`.
- **Procedures are the ONLY layer that throws** — exhaustive `switch` on `result.error.type`.
- Repository pattern: `ResultAsync.fromPromise(drizzleQuery, wrapDbError)` with local `wrapDbError` helper.
- Use case alias: `import { ResultAsync as RA } from 'neverthrow'`.

### Clean Architecture Flow (Backend)

Order is mandatory: **Domain Entity → Port → Repository → Use Case → Contract → Procedure**.

- **Use case shape**: curried factory `makeXxx(deps)(input): ResultAsync<T, Error>`
- **Authorization FIRST** — always the first check in every use case, using `hasPermission(role, 'resource:action')`
- **Procedures are thin** — no business logic, only: instantiate use case → call → switch on error → map output
- **Repositories receive `OrganizationContext`** as first parameter — every query MUST filter by `organizationId`
- **Domain entities**: factory functions `createXxx` (new) and `reconstituteXxx` (from DB). Immutable — state changes return new instances.
- **Map helpers**: `mapToDomain(dbRow)` local to repository, `mapXxxToOutput(entity)` in `procedures/{domain}/`
- **List queries always return** `{ items: T[], totalCount: number }`

### Frontend Flow

Order: **Route → API Hooks → Page/View → Components → Forms**.

- **oRPC client**: `orpc.{domain}.{action}.queryOptions()` / `.mutationOptions()`. URLs are `POST /rpc/{domain}/{action}`. Body: `{ json: {...} }`.
- **Cache invalidation**: `queryClient.invalidateQueries({ queryKey: orpc.{domain}.key() })` on mutations.
- **No `useEffect` for data fetching** — all via TanStack Query. `useEffect` only for cleanup.
- **State sources**: server state = TanStack Query, complex UI = Zustand, simple local = `useState`, auth/org = React Context (read-only).
- **Routing**: file-based TanStack Router. `_authenticated.tsx` layout guards auth via `beforeLoad`. `$orgSlug.tsx` sets org context.
- **Feature structure**: `src/features/{domain}/{ components/, hooks/queries/, hooks/mutations/, views/ }`.
- **Forms**: React Hook Form + `zodResolver(contractSchema)` + `Controller` + `Field/FieldContent/FieldLabel/FieldError` compound component.
- **Tables**: `DataTable` compound component with `.Root`, `.Toolbar`, `.Search`, `.Content`, `.Pagination`.
- **Mutation errors**: `handleMutationError(error, { fallbackMessage })` in `onError` — `UNAUTHORIZED` → redirect `/login`, others → toast.

### TDD Development Cycle

Apply Red → Green → Refactor at each architecture layer before advancing to the next:

1. **Domain Entity** — write entity creation/validation tests → implement entity → refactor
2. **Port** — define interface (no tests needed, it's a type)
3. **Repository** — write repo tests with mock DB → implement → refactor
4. **Use Case** — write use case tests with mock repos → implement → refactor
5. **Contract** — define schemas (validated by type system)
6. **Procedure** — integration tested via E2E or manual

Tests for a layer validate behavior BEFORE moving to the next layer.

### Testing Rules

**Test Organization:**
- Domain entities: `packages/core/src/domain/entities/__tests__/{entity}-{topic}.test.ts`
- Value objects: `packages/core/src/domain/value-objects/__tests__/{name}.test.ts`
- Use cases: `packages/backend/src/use-cases/{domain}/__tests__/{action}.test.ts` (split into `-success.test.ts` / `-validation.test.ts` for large suites)
- Store tests: `apps/coach-web/src/stores/__tests__/{name}.test.ts`
- E2E tests: `apps/coach-web/e2e/` — mock all APIs via `page.route()`, no backend needed

**Test ID Convention:**
- Structured IDs in describe/it: `[ATHLETE.1-UNIT-001] @p0 creates athlete...`
- Priority annotations: `@p0` (critical), `@p1` (high), `@p2` (normal)

**Test Factories** (in `packages/backend/src/__tests__/factories/`):
- `createXxxInput(overrides?)` — generates test input with `@faker-js/faker`
- `createXxxEntity(overrides?)` — generates full domain entity for mocking
- `createXxxRepositoryMock(overrides?)` — `vi.fn()` mock implementing full port interface
- `createTestContext()`, `createAdminContext()`, `createOwnerContext()`, `createMemberContext()` — in `helpers/test-context.ts`

**Mock Pattern:**
```ts
const mockRepo = { create: vi.fn(), findById: vi.fn(), /* ...all port methods */ }
vi.mocked(mockRepo.create).mockReturnValue(okAsync(entity))
```

**Test Structure:**
```ts
describe('[ID] useCase - Category', () => {
  beforeEach(() => { /* reset mocks */ })
  describe('Happy Path', () => {
    it('[ID-001] @p0 should ...', async () => { /* arrange → act → assert */ })
  })
  describe('Authorization', () => { /* forbidden cases */ })
  describe('Validation', () => { /* domain error cases */ })
  describe('Edge Cases', () => { /* repo errors, not found, etc. */ })
})
```

**Coverage Targets:**

| Package | Threshold | Metrics |
|---|---|---|
| `packages/core` | 90% | lines, functions, branches, statements |
| `packages/backend` (use cases) | 80% | lines, functions, branches, statements |

**E2E Mocking:**
- All API calls mocked via `page.route()` in `e2e/mocks/setup-mocks.ts`
- Routes registered in REVERSE order (LIFO) — catch-all FIRST, specific routes AFTER
- Pattern `**/rpc/programs/**` matches `http://localhost:8787/rpc/programs/saveDraft`

### Code Quality & Style

**Biome Formatter:**
- Indent: 2 spaces | Line width: 120 | Line ending: LF
- Single quotes | No semicolons (as needed) | Trailing commas: all
- Arrow parentheses: always

**Biome Linter (key rules):**
- `noUnusedImports`: error
- `noUnusedVariables`: error
- `noUnusedFunctionParameters`: error
- `useConst`: error
- `noNonNullAssertion`: warn
- `noExplicitAny`: warn
- `useSortedClasses`: warn (auto-fix for `className` and `cn()`)

**File Naming:**
- All files: **kebab-case** everywhere (no PascalCase files)
- Ports: `{entity}-repository.port.ts`
- Repositories: `{entity}.repository.ts`
- Use cases: `{action}-{entity}.ts` (e.g., `create-athlete.ts`)
- Procedures: same as use cases
- Hooks: `use-{action}-{entity}.ts` (mutations), `use-{entity}.ts` / `use-{entities}.ts` (queries)
- Views: `{entity}-{type}-view.tsx` (e.g., `athletes-list-view.tsx`)
- Components: `{entity}-{descriptor}.tsx` (e.g., `athlete-form.tsx`)

**Function Naming:**
- React components: `PascalCase`
- Use case factories: `makeXxx` (e.g., `makeCreateAthlete`)
- Repository factories: `createXxxRepository`
- Domain factories: `createXxx` (new), `reconstituteXxx` (from DB)
- Domain state changes: `verbNoun` (e.g., `deactivateAthlete`)
- Map helpers: `mapXxxToOutput`

**Validate before commit:** `pnpm quality` (typecheck + lint:fix)

### Development Workflow

**Pre-implementation:**
- Search codebase for 2-3 existing examples of similar features before implementing anything
- Follow the exact pattern found — do not invent new patterns
- Run `/architecture` skill before planning any backend feature

**Incremental delivery:**
- Stories can be backend-only or frontend-only, but a feature is not complete until both sides are delivered
- Implement incrementally: after each interaction pattern (create, edit, delete, empty state), stop and tell the user what to test
- Do NOT move to the next interaction until confirmed working

**Quality gate:**
- Run `pnpm quality` before every commit (typecheck + lint:fix)
- Run `/quality-gate` after completing all tasks
- Coverage thresholds must pass (90% core, 80% backend use cases)

**Commit messages:**
- Conventional Commits format: `type(scope): description`

**Multi-tenancy safety:**
- Every repository query MUST include `organizationId` filter
- Never expose data across organizations
- RLS policies are a safety net, not the primary guard

**Auth flow:**
- `authProcedure` validates: session → `X-Organization-Slug` header → org membership → role
- `hasPermission(role, 'resource:action')` checked first in every use case
- `UNAUTHORIZED` on frontend → redirect to `/login`

### Critical Don't-Miss Rules

**Anti-patterns — NEVER do:**
- No business logic in procedures — procedures only orchestrate
- No direct DB queries in use cases — always go through repository ports
- No queries on tenant tables without `organizationId` scope
- No Radix UI — project uses Base UI exclusively
- No `useEffect` for data fetching or state sync — use TanStack Query / derived state / callbacks
- No inline Zod schemas for business logic — import from `@strenly/contracts`
- No throwing in domain, ports, repositories, or use cases — only `Result`/`ResultAsync`
- No `as` casting, `!` assertions, or `any` types (see TypeScript Rules for exceptions)

**Database gotchas:**
- IDs are `text` PKs — application generates via `crypto.randomUUID()`, no DB default
- Soft delete uses `archivedAt: timestamp` or `status` enum — never hard delete tenant data
- Audit timestamps: `createdAt` (`.defaultNow()`) and `updatedAt` (`.defaultNow().$onUpdate(() => new Date())`)
- Count + data queries run in `Promise.all()` for efficient list endpoints
- `.returning().then((rows) => rows[0])` to get inserted/updated row

**oRPC wire format (easy to get wrong):**
- URLs use **slashes** not dots: `POST /rpc/programs/get` (not `programs.get`)
- Request body: `{ json: { ...input } }`
- Response body: `{ json: { ...output } }`
- All oRPC calls are HTTP POST

**Contract schema composition:**
- Base entity schema is the source of truth
- Derive inputs via `.pick()`, `.extend()`, `.partial()`
- Timestamps in output are ISO strings (`.toISOString()`), never Date objects
- List output always: `{ items: z.array(schema), totalCount: z.number() }`

**UI considerations agents must handle:**
- Empty states for every list/table
- Pagination for all list views
- Loading and error states on every data-fetching component
- Portal positioning for dropdowns/modals
- Form nesting edge cases

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Search for 2-3 existing examples before implementing new patterns

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Remove rules that become obvious over time

Last Updated: 2026-02-17
