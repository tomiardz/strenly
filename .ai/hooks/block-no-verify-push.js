#!/usr/bin/env bun

/**
 * @description PreToolUse hook to block git commands with --no-verify flag
 * @scope [shared]
 * Exits with code 2 to block the tool call (per Claude Code hooks documentation)
 */

// Read hook data from stdin
let inputData = '';

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    // Parse the hook input JSON
    const hookData = JSON.parse(inputData);

    const toolName = hookData.tool_name;
    const toolInput = hookData.tool_input || {};

    // Only check Bash tool calls
    if (toolName === 'Bash') {
      const command = toolInput.command || '';

      // Check if the command contains both 'git push' and '--no-verify'
      if (command.includes('git push') && command.includes('--no-verify')) {
        // Write error to stderr - this will be shown to Claude
        console.error('❌ BLOCKED: git with --no-verify is not allowed!');
        console.error('The --no-verify flag bypasses important pre-push hooks.');
        console.error('Please run git commands without the --no-verify flag.');

        // Exit code 2 blocks the tool call
        process.exit(2);
      }
    }

    // Allow the tool to execute
    process.exit(0);
  } catch (error) {
    // If we can't parse input, fail open (allow the command)
    process.exit(0);
  }
});
