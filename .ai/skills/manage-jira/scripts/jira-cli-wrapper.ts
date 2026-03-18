#!/usr/bin/env bun

/**
 * jira-cli-wrapper.ts
 *
 * Unified wrapper for Jira operations via Atlassian CLI (acli).
 * All operations require acli to be installed and authenticated.
 *
 * Usage:
 *   bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action verify --ticket DASH-1234
 *   bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action list-subtasks --ticket DASH-1234
 *   bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action create-subtask --parent DASH-1234 --summary "..." --description "..."
 *   bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action transition --ticket DASH-1235 --transition "Code Review"
 *   bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action get-active-sprint --project-key DASH
 *   bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action create --summary "Implement auth" --type Story --assignee @me
 *   bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action search --jql "project = DASH AND status = 'To Do'" --limit 10
 *   bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action add-comment --ticket DASH-1234 --body "Comment text"
 *   bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action edit --ticket DASH-1234 --description "New description"
 *   bun .ai/skills/manage-jira/scripts/jira-cli-wrapper.ts --action edit --ticket DASH-1234 --description-file /path/to/desc.md
 *
 * Actions:
 *   verify            - View ticket details (summary, status, description)
 *   list-subtasks     - List subtasks of a parent ticket
 *   create-subtask    - Create a Subtask under a parent ticket
 *   transition        - Transition a ticket to a new status
 *   get-active-sprint - Get the active sprint for a project
 *   create            - Create a new Jira issue (Story, Task, Bug, or Subtask)
 *   search            - Search tickets via JQL query
 *   add-comment       - Add a comment to a ticket
 *   edit              - Edit a ticket's summary or description
 *
 * Output: JSON with success and action-specific data.
 */

import { acli, commandExists, errorJSON, outputJSON, parseArgs } from "./utils.ts";

interface IssueRecord {
	key?: string;
	fields?: {
		summary?: string;
		status?: { name?: string };
		issuetype?: { name?: string };
		assignee?: { displayName?: string };
	};
}

// ---------------------------------------------------------------------------
// Require acli
// ---------------------------------------------------------------------------

if (!commandExists("acli")) {
	errorJSON(
		"acli is not installed. Install it with:\n  brew tap atlassian/homebrew-acli\n  brew install acli\nMore info: https://developer.atlassian.com/cloud/acli/guides/install-macos/",
	);
}

// ---------------------------------------------------------------------------
// Parse arguments
// ---------------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2), {
	action: { type: "string", required: true, alias: "a" },
	ticket: { type: "string" },
	parent: { type: "string" },
	summary: { type: "string" },
	description: { type: "string" },
	"description-file": { type: "string" },
	transition: { type: "string" },
	type: { type: "string", default: "Story" },
	assignee: { type: "string", default: "@me" },
	"project-key": { type: "string", default: "DASH" },
	jql: { type: "string" },
	limit: { type: "string", default: "20" },
	body: { type: "string" },
});

const action = args.action ?? "";

const VALID_ACTIONS = [
	"verify",
	"list-subtasks",
	"create-subtask",
	"transition",
	"get-active-sprint",
	"create",
	"search",
	"add-comment",
	"edit",
];

if (!VALID_ACTIONS.includes(action)) {
	errorJSON(
		`Invalid action: "${action}". Must be one of: ${VALID_ACTIONS.join(", ")}`,
	);
}

const VALID_ISSUE_TYPES = ["Story", "Task", "Bug", "Subtask"];
const JIRA_BASE_URL = "https://dlocal.atlassian.net/browse";

if (action === "create" || action === "create-subtask") {
	const issueType = action === "create-subtask" ? "Subtask" : (args.type ?? "Story");
	if (!VALID_ISSUE_TYPES.includes(issueType)) {
		errorJSON(
			`Invalid issue type: "${issueType}". Must be one of: ${VALID_ISSUE_TYPES.join(", ")}`,
		);
	}
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

switch (action) {
	case "verify": {
		const ticket = args.ticket;
		if (!ticket) {
			errorJSON("--ticket is required for verify action");
		}

		const result = acli("jira", "workitem", "view", ticket, "--json");
		if (!result.ok) {
			errorJSON(`Failed to verify ticket: ${ticket}`, {
				stderr: result.stderr,
			});
		}

		try {
			const data = JSON.parse(result.stdout);
			outputJSON({
				success: true,
				action: "verify",
				ticket: {
					key: data.key ?? ticket,
					summary: data.fields?.summary ?? "Unknown",
					status: data.fields?.status?.name ?? "Unknown",
					description: data.fields?.description ?? null,
				},
			});
		} catch {
			errorJSON(`Failed to parse acli output for ticket ${ticket}`, {
				raw_output: result.stdout.slice(0, 500),
			});
		}
		break;
	}

	case "list-subtasks": {
		const ticket = args.ticket;
		if (!ticket) {
			errorJSON("--ticket is required for list-subtasks action");
		}

		const result = acli(
			"jira", "workitem", "search",
			"--jql", `parent = ${ticket} ORDER BY created ASC`,
			"--fields", "key,summary,status",
			"--json",
		);

		if (!result.ok) {
			outputJSON({
				success: true,
				action: "list-subtasks",
				parent: ticket,
				subtasks: [],
			});
			break;
		}

		try {
			const data = JSON.parse(result.stdout);
			const issues = Array.isArray(data) ? data : (data.issues ?? []);
			const subtasks = issues.map(
				(issue: IssueRecord) => ({
					key: issue.key ?? "",
					summary: issue.fields?.summary ?? "",
					status: issue.fields?.status?.name ?? "",
				}),
			);

			outputJSON({
				success: true,
				action: "list-subtasks",
				parent: ticket,
				subtasks,
			});
		} catch {
			outputJSON({
				success: true,
				action: "list-subtasks",
				parent: ticket,
				subtasks: [],
				note: "Failed to parse acli output",
			});
		}
		break;
	}

	case "create-subtask": {
		const parent = args.parent;
		const summary = args.summary;
		const description = args.description;
		const projectKey = args["project-key"] ?? "DASH";

		if (!parent) {
			errorJSON("--parent is required for create-subtask action");
		}
		if (!summary) {
			errorJSON("--summary is required for create-subtask action");
		}

		const cmdArgs = [
			"jira", "workitem", "create",
			"--type", "Subtask",
			"--parent", parent,
			"--project", projectKey,
			"--summary", summary,
			"--assignee", "@me",
			"--json",
		];

		if (description) {
			cmdArgs.push("--description", description);
		}

		const result = acli(...cmdArgs);

		if (!result.ok) {
			errorJSON("Failed to create subtask", { stderr: result.stderr });
		}

		let createdKey: string | null = null;
		try {
			const data = JSON.parse(result.stdout);
			createdKey = data.key ?? null;
		} catch {
			const keyMatch = result.stdout.match(/([A-Z]+-\d+)/);
			createdKey = keyMatch?.[1] ?? null;
		}

		outputJSON({
			success: true,
			action: "create-subtask",
			parent,
			created_key: createdKey,
			summary,
			url: createdKey ? `${JIRA_BASE_URL}/${createdKey}` : null,
		});
		break;
	}

	case "transition": {
		const ticket = args.ticket;
		const transition = args.transition;

		if (!ticket) {
			errorJSON("--ticket is required for transition action");
		}
		if (!transition) {
			errorJSON("--transition is required for transition action");
		}

		const result = acli(
			"jira", "workitem", "transition",
			"--key", ticket,
			"--status", transition,
			"--yes",
		);

		if (!result.ok) {
			outputJSON({
				success: false,
				action: "transition",
				ticket,
				transition,
				error: result.stderr || result.stdout || "Transition failed",
				note: "Ticket may already be in the target state, or the transition name may not match an available transition.",
			});
			break;
		}

		outputJSON({
			success: true,
			action: "transition",
			ticket,
			transition,
		});
		break;
	}

	case "get-active-sprint": {
		const projectKey = args["project-key"] ?? "DASH";

		// Step 1: Find board ID for the project
		const boardResult = acli(
			"jira", "board", "search",
			"--project", projectKey,
			"--json",
		);

		if (!boardResult.ok) {
			errorJSON(`Failed to search for boards in project: ${projectKey}`, {
				stderr: boardResult.stderr,
			});
		}

		let boardId: unknown;
		try {
			const boardData = JSON.parse(boardResult.stdout);
			const boards = boardData.values ?? [];

			if (boards.length === 0) {
				errorJSON(`No boards found for project: ${projectKey}`);
			}

			boardId = boards[0].id;
		} catch {
			errorJSON(`Failed to parse board search results for project: ${projectKey}`);
		}

		// Step 2: Get active sprints for the board
		const result = acli(
			"jira", "board", "list-sprints",
			"--id", String(boardId),
			"--state", "active",
			"--json",
		);

		if (!result.ok) {
			errorJSON(`Failed to get active sprint for board: ${boardId}`, {
				stderr: result.stderr,
			});
		}

		try {
			const data = JSON.parse(result.stdout);
			const sprints = data.sprints ?? [];

			if (sprints.length === 0) {
				outputJSON({
					success: false,
					action: "get-active-sprint",
					project: projectKey,
					board_id: boardId,
					error: "No active sprint found",
				});
				break;
			}

			const sprint = sprints[0];
			outputJSON({
				success: true,
				action: "get-active-sprint",
				project: projectKey,
				board_id: boardId,
				sprint: {
					id: sprint.id ?? null,
					name: sprint.name ?? "Unknown",
					state: sprint.state ?? "active",
				},
			});
		} catch {
			errorJSON("Failed to parse active sprint from acli output", {
				raw_output: result.stdout.slice(0, 500),
			});
		}
		break;
	}

	case "create": {
		const summary = args.summary;
		const description = args.description;
		const descriptionFile = args["description-file"];
		const type = args.type ?? "Story";
		const parent = args.parent;
		const assignee = args.assignee ?? "@me";
		const projectKey = args["project-key"] ?? "DASH";

		if (!summary) {
			errorJSON("--summary is required for create action");
		}

		if (type === "Subtask" && !parent) {
			errorJSON("--parent is required when --type is Subtask");
		}

		const cmdArgs = [
			"jira", "workitem", "create",
			"--type", type,
			"--project", projectKey,
			"--summary", summary,
			"--assignee", assignee,
			"--json",
		];

		if (descriptionFile) {
			cmdArgs.push("--description-file", descriptionFile);
		} else if (description) {
			cmdArgs.push("--description", description);
		}

		if (parent) {
			cmdArgs.push("--parent", parent);
		}

		const result = acli(...cmdArgs);

		if (!result.ok) {
			errorJSON(`Failed to create ${type}`, {
				stderr: result.stderr,
				stdout: result.stdout,
			});
		}

		let createdKey: string | null = null;
		try {
			const data = JSON.parse(result.stdout);
			createdKey = data.key ?? null;
		} catch {
			const keyMatch = result.stdout.match(/([A-Z]+-\d+)/);
			createdKey = keyMatch?.[1] ?? null;
		}

		outputJSON({
			success: true,
			action: "create",
			issue: {
				key: createdKey,
				summary,
				type,
				parent: parent ?? null,
				url: createdKey ? `${JIRA_BASE_URL}/${createdKey}` : null,
			},
		});
		break;
	}

	case "search": {
		const jql = args.jql;
		const limit = args.limit ?? "20";

		if (!jql) {
			errorJSON("--jql is required for search action");
		}

		const result = acli(
			"jira", "workitem", "search",
			"--jql", jql,
			"--fields", "key,issuetype,summary,status,assignee",
			"--limit", limit,
			"--json",
		);

		if (!result.ok) {
			errorJSON("Search failed", { stderr: result.stderr });
		}

		try {
			const data = JSON.parse(result.stdout);
			const issues = Array.isArray(data) ? data : (data.issues ?? []);
			const results = issues.map(
				(issue: IssueRecord) => ({
					key: issue.key ?? "",
					type: issue.fields?.issuetype?.name ?? "",
					summary: issue.fields?.summary ?? "",
					status: issue.fields?.status?.name ?? "",
					assignee: issue.fields?.assignee?.displayName ?? "Unassigned",
				}),
			);

			outputJSON({
				success: true,
				action: "search",
				count: results.length,
				issues: results,
			});
		} catch {
			errorJSON("Failed to parse search results", {
				raw_output: result.stdout.slice(0, 500),
			});
		}
		break;
	}

	case "add-comment": {
		const ticket = args.ticket;
		const body = args.body;

		if (!ticket) {
			errorJSON("--ticket is required for add-comment action");
		}
		if (!body) {
			errorJSON("--body is required for add-comment action");
		}

		const result = acli(
			"jira", "workitem", "comment", "create",
			"--key", ticket,
			"--body", body,
		);

		if (!result.ok) {
			errorJSON(`Failed to add comment to ${ticket}`, {
				stderr: result.stderr,
			});
		}

		outputJSON({
			success: true,
			action: "add-comment",
			ticket,
		});
		break;
	}

	case "edit": {
		const ticket = args.ticket;
		const summary = args.summary;
		const description = args.description;
		const descriptionFile = args["description-file"];

		if (!ticket) {
			errorJSON("--ticket is required for edit action");
		}
		if (!summary && !description && !descriptionFile) {
			errorJSON("At least one of --summary, --description, or --description-file is required for edit action");
		}

		const cmdArgs = [
			"jira", "workitem", "edit",
			"--key", ticket,
			"--yes",
		];

		if (summary) {
			cmdArgs.push("--summary", summary);
		}

		if (descriptionFile) {
			cmdArgs.push("--description-file", descriptionFile);
		} else if (description) {
			cmdArgs.push("--description", description);
		}

		const result = acli(...cmdArgs);

		if (!result.ok) {
			errorJSON(`Failed to edit ticket ${ticket}`, {
				stderr: result.stderr,
				stdout: result.stdout,
			});
		}

		outputJSON({
			success: true,
			action: "edit",
			ticket,
		});
		break;
	}
}
