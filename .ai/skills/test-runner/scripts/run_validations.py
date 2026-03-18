#!/usr/bin/env python3
"""
Test runner script that executes code quality validations sequentially.

Runs TypeScript type checking, linting, and tests, then provides a formatted report.
"""

import subprocess
import sys
import json
from typing import Dict, List, Tuple
from dataclasses import dataclass
from enum import Enum


class CheckStatus(Enum):
    PASS = "✅"
    FAIL = "❌"
    SKIP = "⏭️"


@dataclass
class CheckResult:
    name: str
    status: CheckStatus
    errors: List[str]
    output: str
    suggestion: str = ""


def run_command(cmd: List[str], cwd: str = ".") -> Tuple[int, str, str]:
    """Execute a command and return exit code, stdout, stderr."""
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes timeout
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return 1, "", "Command timed out after 5 minutes"
    except Exception as e:
        return 1, "", f"Error running command: {str(e)}"


def parse_typescript_errors(output: str) -> List[str]:
    """Parse TypeScript errors from tsc output."""
    errors = []
    lines = output.split('\n')

    for line in lines:
        line = line.strip()
        # Match lines like: src/file.ts(10,5): error TS2304: Cannot find name 'foo'
        if ': error TS' in line or line.startswith('error TS'):
            errors.append(line)

    return errors


def parse_biome_errors(output: str) -> List[str]:
    """Parse Biome lint errors from output."""
    errors = []
    lines = output.split('\n')

    for line in lines:
        line = line.strip()
        # Biome typically outputs errors with file paths and line numbers
        if line and ('error' in line.lower() or '✖' in line or '×' in line):
            # Skip summary lines
            if 'error(s)' not in line.lower() and 'found' not in line.lower():
                errors.append(line)

    return errors


def parse_vitest_errors(output: str) -> List[str]:
    """Parse Vitest test failures from output."""
    errors = []
    lines = output.split('\n')

    for line in lines:
        line = line.strip()
        # Look for test failure indicators
        if '❯' in line or 'FAIL' in line or 'AssertionError' in line:
            errors.append(line)

    return errors


def suggest_fix(check_name: str, errors: List[str]) -> str:
    """Suggest common fixes based on error patterns."""
    if not errors:
        return ""

    error_text = '\n'.join(errors).lower()

    if check_name == "TypeCheck":
        if "cannot find name" in error_text or "not found" in error_text:
            return "Missing import detected. Review imports in affected files."
        elif "type" in error_text and ("mismatch" in error_text or "not assignable" in error_text):
            return "Type mismatch detected. Verify types match expected signatures."
        elif "unused" in error_text:
            return "Unused variables/imports detected. Remove or prefix with underscore if intentionally unused."
        else:
            return "Review TypeScript errors and fix type issues."

    elif check_name == "Lint":
        return "Run 'pnpm lint:fix' to automatically fix formatting issues."

    elif check_name == "Tests":
        if "assertion" in error_text or "expected" in error_text:
            return "Test assertions failing. Review test expectations vs actual behavior."
        else:
            return "Tests failing. Review test output and fix failing test cases."

    return ""


def run_typecheck() -> CheckResult:
    """Run TypeScript type checking."""
    print("🔍 Running TypeScript type check...")
    exit_code, stdout, stderr = run_command(["pnpm", "typecheck"])

    output = stdout + stderr
    errors = parse_typescript_errors(output)

    status = CheckStatus.PASS if exit_code == 0 else CheckStatus.FAIL
    suggestion = suggest_fix("TypeCheck", errors) if status == CheckStatus.FAIL else ""

    return CheckResult(
        name="TypeCheck",
        status=status,
        errors=errors[:10],  # Limit to first 10 errors for readability
        output=output,
        suggestion=suggestion
    )


def run_lint() -> CheckResult:
    """Run Biome linting."""
    print("🔍 Running Biome lint...")
    exit_code, stdout, stderr = run_command(["pnpm", "lint"])

    output = stdout + stderr
    errors = parse_biome_errors(output)

    status = CheckStatus.PASS if exit_code == 0 else CheckStatus.FAIL
    suggestion = suggest_fix("Lint", errors) if status == CheckStatus.FAIL else ""

    return CheckResult(
        name="Lint",
        status=status,
        errors=errors[:10],  # Limit to first 10 errors
        output=output,
        suggestion=suggestion
    )


def run_tests() -> CheckResult:
    """Run Vitest tests."""
    print("🔍 Running Vitest tests...")
    exit_code, stdout, stderr = run_command(["pnpm", "test"])

    output = stdout + stderr

    # Check if tests exist
    if "no test files found" in output.lower() or "no tests found" in output.lower():
        return CheckResult(
            name="Tests",
            status=CheckStatus.SKIP,
            errors=[],
            output=output,
            suggestion=""
        )

    errors = parse_vitest_errors(output)

    # Try to extract test count from output
    test_info = ""
    if "test suite" in output.lower() or "test" in output.lower():
        for line in output.split('\n'):
            if 'passed' in line.lower() or 'test' in line.lower():
                test_info = f" ({line.strip()})"
                break

    status = CheckStatus.PASS if exit_code == 0 else CheckStatus.FAIL
    suggestion = suggest_fix("Tests", errors) if status == CheckStatus.FAIL else ""

    result = CheckResult(
        name="Tests",
        status=status,
        errors=errors[:10],  # Limit to first 10 errors
        output=output,
        suggestion=suggestion
    )

    return result


def format_report(results: List[CheckResult]) -> str:
    """Format the validation results into a readable report."""
    report = []
    report.append("\n" + "="*60)
    report.append("CODE VALIDATION REPORT")
    report.append("="*60 + "\n")

    # Summary
    all_passed = all(r.status != CheckStatus.FAIL for r in results)

    for result in results:
        status_symbol = result.status.value

        if result.status == CheckStatus.SKIP:
            report.append(f"{result.name}: {status_symbol} Skipped (no tests found)")
        elif result.status == CheckStatus.PASS:
            report.append(f"{result.name}: {status_symbol} Pass")
        else:
            error_count = len(result.errors)
            report.append(f"{result.name}: {status_symbol} {error_count}+ error(s)")

            # Show errors
            for error in result.errors:
                report.append(f"  • {error}")

            if len(result.errors) >= 10:
                report.append(f"  ... (showing first 10 errors)")

            # Show suggestion
            if result.suggestion:
                report.append(f"\n  💡 Suggested fix: {result.suggestion}")

            report.append("")  # Empty line between checks

    # Overall status
    report.append("-"*60)
    if all_passed:
        report.append("✅ All checks passed!")
    else:
        failed_checks = [r.name for r in results if r.status == CheckStatus.FAIL]
        report.append(f"❌ Validation failed: {', '.join(failed_checks)}")
    report.append("="*60 + "\n")

    return '\n'.join(report)


def main():
    """Run all validations and report results."""
    print("Starting code quality validations...\n")

    results = []

    # Run checks sequentially
    results.append(run_typecheck())
    results.append(run_lint())
    results.append(run_tests())

    # Print formatted report
    report = format_report(results)
    print(report)

    # Exit with error code if any check failed
    if any(r.status == CheckStatus.FAIL for r in results):
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
