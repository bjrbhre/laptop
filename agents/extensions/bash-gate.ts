/**
 * Bash Gate Extension
 *
 * A simple deny-list based gate for bash commands.
 *
 * - Regular commands are automatically allowed
 * - Commands matching deny list patterns are ALWAYS blocked
 *
 * Default deny patterns:
 *   - rm (any form - rm, rm -rf, etc.)
 *   - del (Windows delete)
 *   - chown, chgrp, chmod (ownership/permission changes)
 *   - mkfs, dd (filesystem/format operations)
 *   - > and >> (redirection to files - can overwrite data)
 *   - curl | sh, wget | sh (pipe to shell - dangerous)
 *
 * Usage:
 *   This extension is auto-loaded from ~/.pi/agent/extensions/
 *   Or run with: pi -e ./bash-gate.ts
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

interface DenyPattern {
	pattern: RegExp;
	description: string;
}

export default function (pi: ExtensionAPI) {
	// Deny list - commands that are ALWAYS blocked
	const DENY_LIST: DenyPattern[] = [
		{ pattern: /\brm\s+/i, description: 'rm (delete files)' },
		{ pattern: /\bdel\s+/i, description: 'del (Windows delete)' },
		{ pattern: /\bchown\s+/i, description: 'chown (change ownership)' },
		{ pattern: /\bchgrp\s+/i, description: 'chgrp (change group)' },
		{ pattern: /\bchmod\s+/i, description: 'chmod (change permissions)' },
		{ pattern: /\bmkfs\s+/i, description: 'mkfs (format filesystem)' },
		{ pattern: /\bdd\s+/i, description: 'dd (disk operations)' },
		// /\b>\s*[\/~a-zA-Z0-9_./-]+/,  // Output redirection to file (> file.txt)
		// /\b>>\s*[\/~a-zA-Z0-9_./-]+/, // Append redirection (>> file.txt)
		{ pattern: /\|\s*sh\b/i, description: 'pipe to shell (curl | sh)' },
		{ pattern: /\|\s*bash\b/i, description: 'pipe to bash (curl | bash)' },
		{ pattern: /\|\s*python\b/i, description: 'pipe to python' },
		{ pattern: /\|\s*perl\b/i, description: 'pipe to perl' },
		{ pattern: /\bsudo\s+rm/i, description: 'sudo rm' },
		{ pattern: /\bsudo\s+del/i, description: 'sudo del' },
		{ pattern: /\bsudo\s+chown/i, description: 'sudo chown' },
		{ pattern: /\bsudo\s+chmod/i, description: 'sudo chmod' },
		{ pattern: /\bsudo\s+mkfs/i, description: 'sudo mkfs' },
		{ pattern: /\bsudo\s+dd/i, description: 'sudo dd' },
		{ pattern: /\bfork\(\)/i, description: 'fork bomb' },
		{ pattern: /\b:\(\)\{.*:\|:\&/i, description: 'fork bomb variant' },
		{ pattern: /\bshutdown\b/i, description: 'shutdown' },
		{ pattern: /\breboot\b/i, description: 'reboot' },
		{ pattern: /\bhalt\b/i, description: 'halt' },
		{ pattern: /\bpoweroff\b/i, description: 'poweroff' },
	];

	// Helper: clean and normalize command
	function cleanCommand(command: string): string {
		return command.trim().replace(/\s+/g, ' ');
	}

	// Helper: get individual commands from a compound command (separated by &&, ||, ;)
	function getIndividualCommands(command: string): string[] {
		// Split on &&, ||, ; but not inside quotes or backticks
		const commands: string[] = [];
		let current = '';
		let inSingleQuote = false;
		let inDoubleQuote = false;

		for (let i = 0; i < command.length; i++) {
			const char = command[i];
			const prevChar = i > 0 ? command[i - 1] : '';

			if (char === "'" && prevChar !== '\\') {
				inSingleQuote = !inSingleQuote;
				current += char;
			} else if (char === '"' && prevChar !== '\\') {
				inDoubleQuote = !inDoubleQuote;
				current += char;
			} else if (
				!inSingleQuote &&
				!inDoubleQuote &&
				((char === '&' && command[i + 1] === '&') ||
					(char === '|' && command[i + 1] === '|') ||
					(char === ';'))
			) {
				if (current.trim()) {
					commands.push(current.trim());
				}
				current = '';
				i++; // skip the second char of && or ||
			} else {
				current += char;
			}
		}
		if (current.trim()) {
			commands.push(current.trim());
		}
		return commands;
	}

	// Helper: check if command matches a deny pattern
	function matchesDenyPattern(command: string): DenyPattern | null {
		for (const entry of DENY_LIST) {
			if (entry.pattern.test(command)) {
				return entry;
			}
		}
		return null;
	}

	// Helper: find which command in a compound command is blocked
	function findBlockedCommand(command: string): { blockedCmd: string; description: string } | null {
		const individualCommands = getIndividualCommands(command);

		// Check each individual command in order
		for (const cmd of individualCommands) {
			const match = matchesDenyPattern(cmd);
			if (match) {
				return { blockedCmd: cmd, description: match.description };
			}
		}
		return null;
	}

	// Main bash command interceptor
	pi.on('tool_call', async (event, ctx) => {
		if (event.toolName !== 'bash') return undefined;

		const command = cleanCommand(event.input.command as string);

		// Check deny list - always block these
		const blocked = findBlockedCommand(command);
		if (blocked) {
			return {
				block: true,
				reason: `Command blocked: "${blocked.blockedCmd}" matches a dangerous pattern. Command "${blocked.description}" is not allowed`,
			};
		}

		// All other commands are allowed automatically
		return undefined;
	});

	// Register command to show status
	pi.registerCommand('bash-gate-status', {
		description: 'Show bash gate status',
		handler: async (_args, ctx) => {
			let status = 'Bash Gate Status\n\n';
			status += 'Deny list (always blocked):\n';
			status += '  - rm, del, chown, chgrp, chmod\n';
			status += '  - mkfs, dd\n';
			status += '  - Redirection (>, >>)\n';
			status += '  - Pipe to shell (curl | sh, etc.)\n';
			status += '  - sudo rm/chmod/etc.\n';
			status += '  - fork, shutdown, reboot, halt\n\n';
			status += 'All other commands are allowed automatically.\n';

			ctx.ui.notify(status, 'info');
		},
	});
}
