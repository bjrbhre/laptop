/**
 * Tools Extension
 *
 * Provides a /tools command to enable/disable tools interactively.
 * Tool selection persists across session reloads and respects branch navigation.
 *
 * Supports settings.json configuration:
 * - `disabledTools`: Array of tool names to disable by default (all others enabled)
 *
 * Settings are read from:
 * - ~/.pi/agent/settings.json (global)
 * - .pi/settings.json (project - overrides global)
 *
 * Example settings.json:
 * ```json
 * {
 *   "disabledTools": ["bash", "write"]
 * }
 * ```
 *
 * Usage:
 * 1. Copy this file to ~/.pi/agent/extensions/ or your project's .pi/extensions/
 * 2. Set disabledTools in settings.json for persistent defaults
 * 3. Use /tools to open the tool selector for temporary overrides
 */

import type { ExtensionAPI, ExtensionContext, ToolInfo } from "@mariozechner/pi-coding-agent";
import { getAgentDir, getSettingsListTheme } from "@mariozechner/pi-coding-agent";
import { Container, type SettingItem, SettingsList } from "@mariozechner/pi-tui";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// State persisted to session
interface ToolsState {
	enabledTools: string[];
}

// Settings schema
interface ToolsSettings {
	disabledTools?: string[];
}

/**
 * Load tools settings from settings.json files.
 * Project settings override global settings.
 */
function loadToolsSettings(cwd: string): ToolsSettings {
	const globalPath = join(getAgentDir(), "settings.json");
	const projectPath = join(cwd, ".pi", "settings.json");

	let globalSettings: ToolsSettings = {};
	let projectSettings: ToolsSettings = {};

	// Load global settings
	if (existsSync(globalPath)) {
		try {
			const content = readFileSync(globalPath, "utf-8");
			const parsed = JSON.parse(content);
			globalSettings = { disabledTools: parsed.disabledTools };
		} catch {
			// Ignore parse errors
		}
	}

	// Load project settings
	if (existsSync(projectPath)) {
		try {
			const content = readFileSync(projectPath, "utf-8");
			const parsed = JSON.parse(content);
			projectSettings = { disabledTools: parsed.disabledTools };
		} catch {
			// Ignore parse errors
		}
	}

	// Merge (project overrides global)
	return {
		...globalSettings,
		...projectSettings,
	};
}

export default function toolsExtension(pi: ExtensionAPI) {
	// Track enabled tools
	let enabledTools: Set<string> = new Set();
	let allTools: ToolInfo[] = [];

	// Persist current state
	function persistState() {
		pi.appendEntry<ToolsState>("tools-config", {
			enabledTools: Array.from(enabledTools),
		});
	}

	// Apply current tool selection
	function applyTools() {
		pi.setActiveTools(Array.from(enabledTools));
	}

	// Initialize tools based on settings and session state
	function initializeTools(ctx: ExtensionContext) {
		allTools = pi.getAllTools();
		const allToolNames = allTools.map((t) => t.name);

		// Get settings-based defaults
		const settings = loadToolsSettings(ctx.cwd);
		const disabledFromSettings = new Set(settings.disabledTools ?? []);

		// Get entries in current branch only
		const branchEntries = ctx.sessionManager.getBranch();
		let savedTools: string[] | undefined;

		for (const entry of branchEntries) {
			if (entry.type === "custom" && entry.customType === "tools-config") {
				const data = entry.data as ToolsState | undefined;
				if (data?.enabledTools) {
					savedTools = data.enabledTools;
				}
			}
		}

		if (savedTools) {
			// Restore saved tool selection (filter to only tools that still exist)
			enabledTools = new Set(savedTools.filter((t: string) => allToolNames.includes(t)));
		} else {
			// No saved state - use settings defaults
			// Enable all tools except those in disabledTools
			enabledTools = new Set(
				allToolNames.filter((t) => !disabledFromSettings.has(t))
			);
		}

		applyTools();
	}

	// Register /tools command
	pi.registerCommand("tools", {
		description: "Enable/disable tools",
		handler: async (_args, ctx) => {
			// Refresh tool list
			allTools = pi.getAllTools();

			await ctx.ui.custom((tui, theme, _kb, done) => {
				// Build settings items for each tool
				const items: SettingItem[] = allTools.map((tool) => ({
					id: tool.name,
					label: tool.name,
					currentValue: enabledTools.has(tool.name) ? "enabled" : "disabled",
					values: ["enabled", "disabled"],
				}));

				const container = new Container();
				container.addChild(
					new (class {
						render(_width: number) {
							return [theme.fg("accent", theme.bold("Tool Configuration")), ""];
						}
						invalidate() {}
					})(),
				);

				const settingsList = new SettingsList(
					items,
					Math.min(items.length + 2, 15),
					getSettingsListTheme(),
					(id, newValue) => {
						// Update enabled state and apply immediately
						if (newValue === "enabled") {
							enabledTools.add(id);
						} else {
							enabledTools.delete(id);
						}
						applyTools();
						persistState();
					},
					() => {
						// Close dialog
						done(undefined);
					},
				);

				container.addChild(settingsList);

				const component = {
					render(width: number) {
						return container.render(width);
					},
					invalidate() {
						container.invalidate();
					},
					handleInput(data: string) {
						settingsList.handleInput?.(data);
						tui.requestRender();
					},
				};

				return component;
			});
		},
	});

	// Initialize on session start
	pi.on("session_start", async (_event, ctx) => {
		initializeTools(ctx);
	});

	// Restore state when navigating the session tree
	pi.on("session_tree", async (_event, ctx) => {
		initializeTools(ctx);
	});

	// Restore state after forking
	pi.on("session_fork", async (_event, ctx) => {
		initializeTools(ctx);
	});
}
