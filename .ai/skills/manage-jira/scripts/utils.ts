import { spawnSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArgDef {
	type: "string";
	required?: boolean;
	alias?: string;
	default?: string;
}

interface ExecResult {
	ok: boolean;
	stdout: string;
	stderr: string;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

export function parseArgs(
	argv: string[],
	schema: Record<string, ArgDef>,
): Record<string, string | undefined> {
	const result: Record<string, string | undefined> = {};
	const aliasMap = new Map<string, string>();

	for (const [key, def] of Object.entries(schema)) {
		if (def.default !== undefined) {
			result[key] = def.default;
		}
		if (def.alias) {
			aliasMap.set(def.alias, key);
		}
	}

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		let key: string | undefined;

		if (arg.startsWith("--")) {
			key = arg.slice(2);
		} else if (arg.startsWith("-") && arg.length === 2) {
			key = aliasMap.get(arg.slice(1));
		}

		if (key && key in schema) {
			const value = argv[i + 1];
			if (value !== undefined && !value.startsWith("-")) {
				result[key] = value;
				i++;
			}
		}
	}

	for (const [key, def] of Object.entries(schema)) {
		if (def.required && result[key] === undefined) {
			errorJSON(`Missing required argument: --${key}`);
		}
	}

	return result;
}

// ---------------------------------------------------------------------------
// Shell helpers
// ---------------------------------------------------------------------------

export function commandExists(cmd: string): boolean {
	const result = spawnSync("which", [cmd], { encoding: "utf-8" });
	return result.status === 0;
}

export function run(cmd: string, args: string[]): ExecResult {
	const result = spawnSync(cmd, args, {
		encoding: "utf-8",
		maxBuffer: 10 * 1024 * 1024,
	});
	return {
		ok: result.status === 0,
		stdout: (result.stdout ?? "").toString(),
		stderr: (result.stderr ?? "").toString(),
	};
}

export function acli(...args: string[]): ExecResult {
	return run("acli", args);
}

// ---------------------------------------------------------------------------
// JSON output
// ---------------------------------------------------------------------------

export function outputJSON(data: Record<string, unknown>): never {
	console.log(JSON.stringify(data, null, 2));
	process.exit(0);
}

export function errorJSON(
	message: string,
	extra?: Record<string, unknown>,
): never {
	console.log(
		JSON.stringify({ success: false, error: message, ...extra }, null, 2),
	);
	process.exit(1);
}
