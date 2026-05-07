/**
 * Env Guard - Block access to .env files
 *
 * Prevents reading/writing .env and .env.* files (except .env.example).
 * Intercepts read, write, edit, and bash tool calls.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const ALLOWED_ENV_FILE = ".env.example";

// Matches ".env" or ".env.<suffix>" as a filename component, but not .env.example
const RESTRICTED_ENV_PATTERN = /(?<=^|[^a-zA-Z0-9_])\.env(?:\.[a-zA-Z0-9_-]+)?(?![a-zA-Z0-9_-])/gi;

function isRestrictedPath(str: string): boolean {
	if (typeof str !== "string") return false;

	let normalized = str;
	try { normalized = decodeURIComponent(str); } catch { /* ignore */ }
	normalized = normalized.replace(/\\/g, "");

	const matches = normalized.match(RESTRICTED_ENV_PATTERN);
	if (!matches) return false;

	return matches.some((match) => {
		const clean = match.replace(/^['"\/]|['"\/]$/g, "");
		return clean.toLowerCase() !== ALLOWED_ENV_FILE.toLowerCase();
	});
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		const input = event.input as Record<string, unknown>;
		const path = input.path as string | undefined;
		const command = input.command as string | undefined;

		let blocked = false;
		let reason = "";

		if (event.toolName === "read" && path && isRestrictedPath(path)) {
			blocked = true;
			reason = `Reading .env files is blocked. Attempted: ${path}`;
		} else if ((event.toolName === "write" || event.toolName === "edit") && path && isRestrictedPath(path)) {
			blocked = true;
			reason = `Writing to .env files is blocked. Attempted: ${path}`;
		} else if (event.toolName === "bash" && command && isRestrictedPath(command)) {
			blocked = true;
			reason = `Bash command references restricted .env files.`;
		}

		if (blocked) {
			if (ctx.hasUI) ctx.ui.notify(`🛡️ Blocked: ${reason}`, "warning");
			return { block: true, reason };
		}

		return undefined;
	});

	pi.on("session_start", async (_event, ctx) => {
		if (ctx.hasUI) ctx.ui.setStatus("env-guard", "🛡️ .env");
	});
}
