---
name: generate-readme
description: >-
  Generates or updates a README.md for any repository by scanning its codebase
  and applying the team-standard template. Supports update mode (default) and
  --clean mode. Use when the user mentions "readme", "generate readme",
  "update readme", or "create readme".
scope: ["shared"]
---

# Generate README

Generate a comprehensive README.md by scanning the repository codebase and filling in the team-standard template. Output is accurate (based on actual files found), concise, and useful for both humans and AI agents.

For the generation workflow, follow [workflows/generate.md](workflows/generate.md).

## Modes

**Update mode** (default):
- The existing README.md MUST be read before generating
- Custom sections not in the template MUST be preserved at the end under their original headings
- Existing descriptions, overview text, and manually written context MUST be merged where it adds value — the codebase scan cannot infer everything

**Clean mode** (`--clean`):
- The existing README.md MUST be ignored completely — no content carried over
- Output MUST contain only template-defined sections filled with codebase data
- Use when the existing README is outdated, wrong, or you want a fresh start

## Context Gathering

Gather this information before generating. Use parallel tool calls where possible.

**Package and project metadata:**
- `package.json` (or equivalent: `Cargo.toml`, `pyproject.toml`, `go.mod`, `pom.xml`)
- `git remote get-url origin`
- `LICENSE*` files

**Codebase structure:**
- Directory tree (max depth 3, excluding node_modules, .git, dist, .next, coverage, .turbo)
- Config files: `*.config.*`, `tsconfig.*`, `.env.example`, `.eslintrc*`, `.prettierrc*`, `vitest.*`, `jest.config.*`, `playwright.config.*`, `docker-compose*`, `Dockerfile*`, `Makefile`, `turbo.json`, `pnpm-workspace.yaml`

**Scripts and dependencies:**
- Available scripts from package.json (or Makefile targets, etc.)
- Dependencies list for tech stack detection

**CI/CD and deployment:**
- `.github/workflows/*.yml`, `.gitlab-ci.yml`, `Jenkinsfile`, `bitbucket-pipelines.yml`
- Docker files
- Env example file for configuration reference (preferred: `.env.example`; fallbacks: `.env.dist`, `.env.sample`, `.env.template`)

## Section Fill Rules

Fill each template section using verified codebase data:

- **Project Name**: from package manifest name field or directory name
- **Description**: from package manifest description (update mode: merge with existing if richer)
- **Overview**: expand based on what the project actually does
- **Tech Stack**: detect from dependencies, config files, and file extensions
- **Architecture**: infer from directory structure, entry points, and framework conventions
- **Getting Started**: use actual commands from scripts, Docker files, etc.
- **Configuration**: look for an env example file (preferred: `.env.example`; fallbacks: `.env.dist`, `.env.sample`, `.env.template`). If found, show a `cp <file> .env` command. If none exists, omit the Configuration section entirely — do NOT generate an env var table
- **Development**: from actual scripts in the project
- **Deployment**: from CI/CD configs, Docker files, or existing docs
- **Contributing**: use existing CONTRIBUTING.md if present, otherwise standard flow
- **License**: from LICENSE file

## Content Rules

- ONLY include information verifiable from the codebase — do NOT fabricate URLs, versions, or features
- Keep language direct and factual — no marketing copy, no filler
- Code blocks must contain actual, runnable commands from the project
- Never generate an env var table — if an env example file exists, reference it with a `cp` command; if not, omit Configuration entirely
- If the project is a monorepo, note this in Architecture and list the workspaces
- Do not add badges — they go stale and add noise
- Use tables for structured data (tech stack) — scannable by humans and AI

## Validation

Before writing the final output, verify:
- Every section contains real, verifiable information from the codebase
- No template placeholders (`{...}`) remain in the output
- Commands in code blocks are actual project commands
- Tech stack matches actual dependencies
- Architecture section reflects real directory structure
- The file renders correctly as GitHub-flavored Markdown
- Sections with no applicable content are omitted, not left empty
- Mode rules from `## Modes` are satisfied
