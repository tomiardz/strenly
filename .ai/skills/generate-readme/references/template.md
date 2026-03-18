## Template Instructions

This is the team-standard README template. Fill in every `{...}` placeholder with real data from the repository. Omit any section entirely if it has no applicable content. Do not leave placeholders or empty sections in the final output.

## README Template

# {Project Name}

> {One-line description: what this project does and why it exists.}

## Overview

{2-4 sentences expanding on the description. What problem does it solve? Who is it for? What makes it different from alternatives (if applicable)?}

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | {e.g., TypeScript 5.x} |
| Runtime | {e.g., Node.js 22} |
| Framework | {e.g., Next.js 15} |
| Package Manager | {e.g., pnpm 9} |
| Database | {e.g., PostgreSQL 16} |
| Testing | {e.g., Vitest, Playwright} |
| CI/CD | {e.g., GitHub Actions} |

## Architecture

{High-level description of how the system is structured. Include a brief diagram if it helps (Mermaid or ASCII). Describe the major components and how they interact.}

```
{Optional: simple directory map of key areas}
src/
├── components/   # Shared UI components
├── features/     # Feature modules
├── lib/          # Shared utilities
└── app/          # Routes / entry points
```

## Getting Started

### Prerequisites

- {Runtime} >= {version}
- {Package manager}
- {Any other required tools}

### Installation

```bash
{exact install commands}
```

### Configuration

{Check for an env example file in the repo (preferred: `.env.example`; fallbacks: `.env.dist`, `.env.sample`, `.env.template`). If one exists, reference it:}

```bash
cp .env.example .env  # use the actual filename found
```

{Then open `.env` and fill in the required values. If no env example file exists, omit this section entirely — do NOT create a table of env vars.}

### Running Locally

```bash
{exact command to start the project}
```

## Development

### Available Commands

```bash
{dev command}      # Start dev server
{build command}    # Production build
{test command}     # Run tests
{lint command}     # Lint and format
```

### Testing

{Brief description of testing strategy. What types of tests exist? How to run them?}

```bash
{test commands with common flags}
```

### Code Conventions

{Only include conventions that are non-obvious or project-specific. Skip standard language conventions.}

- {e.g., File naming: kebab-case for files, PascalCase for components}
- {e.g., Branching: feature/TICKET-123-description}
- {e.g., Commits: conventional commits (feat:, fix:, chore:)}

## Deployment

{How the project is deployed. Keep it brief — link to detailed docs if needed.}

- **Environment(s):** {e.g., staging, production}
- **Deploy trigger:** {e.g., merge to main, manual, CI/CD}
- **URL(s):** {production/staging URLs if applicable}

## Contributing

{Brief contribution instructions or link to CONTRIBUTING.md.}

1. Create a branch from `{default branch}`
2. Make your changes
3. Run `{test command}` and `{lint command}`
4. Open a pull request

## License

{License type}. See [LICENSE](./LICENSE) for details.
