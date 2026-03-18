---
name: playwright-cli
description: "Reference for Playwright Test CLI commands, flags, and patterns. Use this skill whenever writing, running, debugging, or configuring Playwright tests from the command line. Triggers on: running playwright tests, filtering tests by name/project/file, debugging test failures, using headed/UI mode, sharding tests, updating snapshots, viewing reports/traces, generating test code with codegen, or any question about npx playwright commands and their flags. Also use when configuring CI for Playwright (sharding, retries, reporters) or troubleshooting flaky tests."
scope: ["shared"]
---

# Playwright Test CLI

## Running Tests

```bash
# Run all tests
npx playwright test

# Run a specific file
npx playwright test tests/todo-page.spec.ts

# Run tests in a directory
npx playwright test tests/checkout/

# Run by title (regex match with -g/--grep)
npx playwright test -g "add a todo item"

# Run by title — inverse match
npx playwright test --grep-invert "delete"

# Run specific project(s)
npx playwright test --project chromium --project firefox

# Run in headed mode (visible browser)
npx playwright test --headed

# Run in debug mode (Playwright Inspector)
npx playwright test --debug

# Run in interactive UI mode
npx playwright test --ui
```

## Commonly Used Flags

| Flag | Description |
|---|---|
| `-g, --grep <regex>` | Filter tests by title pattern |
| `--grep-invert <regex>` | Exclude tests matching pattern |
| `--project <name>` | Run only named project(s), repeatable |
| `-j, --workers <count>` | Number of parallel workers |
| `--headed` | Show browser windows |
| `--debug` | Open Playwright Inspector |
| `--ui` | Interactive UI mode |
| `-u, --update-snapshots` | Update snapshot expectations |
| `--retries <n>` | Retry failed tests n times |
| `--max-failures <n>` | Stop after n test failures |
| `--reporter <type>` | Choose reporter: `list`, `dot`, `html`, `json`, `junit` |
| `--output <dir>` | Test artifacts output directory |
| `-c, --config <file>` | Path to config file |
| `--timeout <ms>` | Per-test timeout |
| `--global-timeout <ms>` | Total suite timeout |
| `--forbid-only` | Fail if `test.only()` is present (useful in CI) |
| `--fail-on-flaky-tests` | Treat flaky tests as failures |
| `--fully-parallel` | Run all tests in parallel |
| `--last-failed` | Re-run only tests that failed in the last run |
| `--repeat-each <n>` | Run each test n times (for flake detection) |
| `--trace <mode>` | Trace recording: `on`, `off`, `retain-on-failure`, `on-first-retry` |
| `--shard <current>/<total>` | Shard tests for parallel CI (e.g., `--shard 1/3`) |
| `--list` | List all tests without running them |
| `--pass-with-no-tests` | Exit 0 even if no tests match |

## Debugging Failed Tests

```bash
# Debug a specific failing test
npx playwright test -g "checkout flow" --debug

# Run with trace, then inspect failures
npx playwright test --trace retain-on-failure
npx playwright show-trace test-results/trace.zip

# Run headed in slow motion (via config or env)
PWDEBUG=1 npx playwright test -g "login"

# Retry to identify flakiness
npx playwright test --retries 3 --fail-on-flaky-tests
```

## Test Filtering with --test-list

For advanced filtering, pass a file listing specific tests:

```bash
npx playwright test --test-list tests-to-run.txt
npx playwright test --test-list-invert tests-to-skip.txt
```

File format supports multiple levels of specificity:
```
path/to/example.spec.ts
[chromium] > path/to/example.spec.ts
path/to/example.spec.ts > suite name
[chromium] > path/to/example.spec.ts:3:9 > suite > test
```

## Reports and Traces

```bash
# Show the HTML report from the last run
npx playwright show-report

# Show a report from a specific directory
npx playwright show-report playwright-report --port 9323

# View a trace file
npx playwright show-trace test-results/path/trace.zip

# Merge blob reports from sharded CI runs
npx playwright merge-reports blob-report-dir --reporter html
```

## Code Generation

```bash
# Open codegen recorder
npx playwright codegen

# Record against a URL
npx playwright codegen https://example.com

# Save generated code to file
npx playwright codegen -o tests/generated.spec.ts https://example.com

# Use a specific browser
npx playwright codegen --browser firefox https://example.com

# Use a custom test ID attribute
npx playwright codegen --test-id-attribute data-testid https://example.com
```

## Browser Management

```bash
# Install all browsers
npx playwright install

# Install a specific browser
npx playwright install chromium

# Install browsers with system dependencies
npx playwright install --with-deps

# Install only system dependencies (useful in Docker)
npx playwright install-deps

# Remove all browsers
npx playwright uninstall

# Force reinstall
npx playwright install --force
```

## CI Patterns

### Sharding across CI runners

Split the test suite across multiple machines:

```bash
# Machine 1
npx playwright test --shard 1/3 --reporter blob

# Machine 2
npx playwright test --shard 2/3 --reporter blob

# Machine 3
npx playwright test --shard 3/3 --reporter blob

# After all shards finish, merge reports
npx playwright merge-reports blob-report-dir --reporter html
```

### Recommended CI flags

```bash
npx playwright test \
  --forbid-only \
  --retries 2 \
  --reporter github,html \
  --fail-on-flaky-tests
```

## Cache Management

```bash
# Clear all Playwright caches (browsers, test results, etc.)
npx playwright clear-cache
```
