/**
 * Web Search Extension
 *
 * Replaces the web-search skill with direct tool calls.
 * Provides web_search and web_fetch tools for the LLM.
 *
 * Requires WEB_SEARCH_ROOT environment variable pointing to ddg-web-search.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	truncateHead,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Cache configuration
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const DEFAULT_CACHE_DIR = "/tmp/pi_web_search";

// Cache key generation
function generateCacheKey(type: "search" | "fetch", params: Record<string, any>): string {
	const sortedParams = Object.keys(params)
		.sort()
		.map((k) => `${k}:${params[k]}`)
		.join("|");
	const hash = crypto.createHash("md5").update(`${type}:${sortedParams}`).digest("hex");
	return `${type}_${hash}`;
}

// Cache storage class
class FileCache {
	private cacheDir: string;

	constructor(cacheDir: string) {
		this.cacheDir = cacheDir;
		// Ensure cache directory exists
		if (!fs.existsSync(this.cacheDir)) {
			fs.mkdirSync(this.cacheDir, { recursive: true });
		}
	}

	private getCachePath(key: string): string {
		// Extract hash from key (format: "type_hash")
		const parts = key.split("_");
		if (parts.length < 2) {
			return path.join(this.cacheDir, `${key}.cache`);
		}
		const hash = parts[1];
		// Create subdirectory structure based on hash characters
		// Example: fetch_a1f1c4ee... → fetch/a1/f1/
		const type = parts[0];
		const subdir1 = hash.substring(0, 2);
		const subdir2 = hash.substring(2, 4);
		const dirPath = path.join(this.cacheDir, type, subdir1, subdir2);

		// Ensure subdirectory exists
		if (!fs.existsSync(dirPath)) {
			fs.mkdirSync(dirPath, { recursive: true });
		}

		return path.join(dirPath, `${key}.cache`);
	}

	get(key: string): string | null {
		const cachePath = this.getCachePath(key);
		try {
			if (!fs.existsSync(cachePath)) {
				return null;
			}
			const data = fs.readFileSync(cachePath, "utf-8");
			const cacheEntry = JSON.parse(data);
			const now = Date.now();
			if (now - cacheEntry.timestamp > CACHE_TTL_MS) {
				// Expired, remove it
				fs.unlinkSync(cachePath);
				return null;
			}
			return cacheEntry.content;
		} catch (err) {
			// Corrupted cache, remove it
			try {
				fs.unlinkSync(cachePath);
			} catch {}
			return null;
		}
	}

	set(key: string, content: string): void {
		const cachePath = this.getCachePath(key);
		const cacheEntry = {
			content,
			timestamp: Date.now(),
		};
		fs.writeFileSync(cachePath, JSON.stringify(cacheEntry), "utf-8");
	}
}

// Tool parameter schemas
const WebSearchParams = Type.Object({
	query: Type.String({ description: "Search query" }),
	limit: Type.Optional(Type.Number({ description: "Maximum number of results (default: 10)" })),
});

const WebFetchParams = Type.Object({
	url: Type.String({ description: "URL to fetch" }),
	raw: Type.Optional(Type.Boolean({ description: "Return raw HTML instead of markdown" })),
	start_line: Type.Optional(Type.Number({ description: "Starting line number (0-indexed, default: 0)" })),
	end_line: Type.Optional(Type.Number({ description: "Ending line number (-1 for last line, default: -1)" })),
});

// Details types for rendering
interface WebSearchDetails {
	query: string;
	limit: number;
	resultCount: number;
	truncated?: boolean;
	isCached?: boolean;
	total_lines?: number;
}

interface WebFetchDetails {
	url: string;
	raw: boolean;
	truncated?: boolean;
	start_line?: number;
	end_line?: number;
	isCached?: boolean;
	total_lines?: number;
}

// Get the WEB_SEARCH_ROOT env var
function getWebSearchRoot(): string | null {
	return process.env.WEB_SEARCH_ROOT ?? null;
}

// Execute the CLI command
async function runCli(
	pi: ExtensionAPI,
	command: "search" | "fetch" | "quick",
	args: string[],
	options?: { cwd?: string },
): Promise<{ stdout: string; stderr: string; code: number }> {
	const root = getWebSearchRoot();
	if (!root) {
		throw new Error("WEB_SEARCH_ROOT environment variable is not set");
	}

	const fullArgs = [
		"--directory",
		`${root}/api`,
		"run",
		"cli.py",
		command,
		...args,
	];

	return pi.exec("uv", fullArgs, {
		cwd: options?.cwd,
		timeout: 30000,
	});
}

// Get cache directory (fixed to /tmp)
function getCacheDir(): string {
	return DEFAULT_CACHE_DIR;
}

export default function (pi: ExtensionAPI) {
	// Warn on startup if WEB_SEARCH_ROOT is not set
	pi.on("session_start", async (_event, ctx) => {
		if (!getWebSearchRoot()) {
			ctx.ui.notify(
				"web-search: WEB_SEARCH_ROOT not set. Set it to your ddg-web-search directory.",
				"warning",
			);
		}
	});

	// Initialize cache
	const cache = new FileCache(getCacheDir());

	// Register web_search tool
	pi.registerTool({
		name: "web_search",
		label: "Web Search",
		description: `Search the web. Returns search results with titles, URLs, and snippets. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}.`,
		promptSnippet: "Search the web for relevant information",
		promptGuidelines: [
			"Call web_search whenever you need to find information on the web, use this whenever you might need more context or are unsure how to answer user"
		],
		parameters: WebSearchParams,

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const { query, limit = 10 } = params;

			// Check for cancellation
			if (signal?.aborted) {
				return {
					content: [{ type: "text", text: "Search cancelled" }],
					isError: true,
				};
			}

			// Build cache key
			const cacheKey = generateCacheKey("search", { query, limit });
			const cachedResult = cache.get(cacheKey);

			if (cachedResult) {
				// Return cached result
				return {
					content: [{ type: "text", text: cachedResult }],
					details: { query, limit, resultCount: cachedResult.split("\n").filter((l) => l.trim()).length, isCached: true, total_lines: cachedResult.split("\n").length } as WebSearchDetails,
				};
			}

			// Build args
			const args = ["-l", String(limit), query];

			try {
				const result = await runCli(pi, "search", args, { cwd: ctx.cwd });

				if (result.code !== 0) {
					return {
						content: [
							{
								type: "text",
								text: `Search failed: ${result.stderr || "Unknown error"}`,
							},
						],
						isError: true,
						details: { query, limit, resultCount: 0, total_lines: 0 } as WebSearchDetails,
					};
				}

				const output = result.stdout.trim();

				if (!output) {
					return {
						content: [{ type: "text", text: "No results found" }],
						details: { query, limit, resultCount: 0, total_lines: 0 } as WebSearchDetails,
					};
				}

				// Truncate if needed
				const truncation = truncateHead(output, {
					maxLines: DEFAULT_MAX_LINES,
					maxBytes: DEFAULT_MAX_BYTES,
				});

				const details: WebSearchDetails = {
					query,
					limit,
					resultCount: output.split("\n").filter((l) => l.trim()).length,
					truncated: truncation.truncated,
					total_lines: truncation.totalLines,
				};

				let text = truncation.content;
				if (truncation.truncated) {
					text += `\n\n[Output truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines]`;
				}

				// Cache the result
				cache.set(cacheKey, text);

				return {
					content: [{ type: "text", text }],
					details,
				};
			} catch (err: any) {
				const message =
					err.message?.includes("WEB_SEARCH_ROOT")
						? "WEB_SEARCH_ROOT environment variable is not set. Please set it to your ddg-web-search directory."
						: `Search failed: ${err.message}`;

				return {
					content: [{ type: "text", text: message }],
					isError: true,
					details: { query, limit, resultCount: 0, total_lines: 0 } as WebSearchDetails,
				};
			}
		},

		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("web_search "));
			text += theme.fg("accent", `"${args.query}"`);
			if (args.limit) {
				text += theme.fg("dim", ` (limit: ${args.limit})`);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as WebSearchDetails | undefined;

			if (isPartial) {
				return new Text(theme.fg("warning", "Searching..."), 0, 0);
			}

			if (result.isError) {
				const content = result.content[0];
				const errorMsg = content?.type === "text" ? content.text : "Error";
				return new Text(theme.fg("error", errorMsg), 0, 0);
			}

			if (!details || details.resultCount === 0) {
				return new Text(theme.fg("dim", "No results"), 0, 0);
			}

			let text = theme.fg("success", `${details.resultCount} results`);
			if (details.total_lines !== undefined && details.total_lines > 0) {
				text += theme.fg("dim", ` of ${details.total_lines} total lines`);
			}
			if (details.truncated) {
				text += theme.fg("warning", " (truncated)");
			}
			if (details?.isCached) {
				text += theme.fg("muted", " (cached)");
			}

			if (expanded) {
				const content = result.content[0];
				if (content?.type === "text") {
					const lines = content.text.split("\n").slice(0, 10);
					for (const line of lines) {
						text += `\n${theme.fg("dim", line)}`;
					}
					if (content.text.split("\n").length > 10) {
						text += `\n${theme.fg("muted", "...")}`;
					}
				}
			}

			return new Text(text, 0, 0);
		},
	});

	// Register web_fetch tool
	pi.registerTool({
		name: "web_fetch",
		label: "Web Fetch",
		description: `Fetch a webpage and convert to markdown (or raw HTML). Use this instead of curl for readable content. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}.`,
		promptSnippet: "Fetch any webpage and format it as markdown",
		promptGuidelines: [
			"Call web_fetch to fetch a webpage, by default it will be formatted to markdown to make it easier to read"
		],
		parameters: WebFetchParams,

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const { url, raw = false, start_line = 0, end_line = -1 } = params;

			if (signal?.aborted) {
				return {
					content: [{ type: "text", text: "Fetch cancelled" }],
					isError: true,
				};
			}

			// Build cache key (only URL and raw, not line range)
			const cacheKey = generateCacheKey("fetch", { url, raw });
			const cachedResult = cache.get(cacheKey);

			let fullContent: string;

			if (cachedResult) {
				// Use cached full result
				fullContent = cachedResult;
			} else {
				// Fetch full content from CLI
				const args = raw ? ["--raw", url] : [url];

				try {
					const result = await runCli(pi, "fetch", args, { cwd: ctx.cwd });

					if (result.code !== 0) {
						return {
							content: [
								{
									type: "text",
									text: `Fetch failed: ${result.stderr || "Unknown error"}`,
								},
							],
							isError: true,
							details: { url, raw, truncated: false, start_line, end_line } as WebFetchDetails,
						};
					}

					fullContent = result.stdout;

					// Cache the full content
					cache.set(cacheKey, fullContent);
				} catch (err: any) {
					const message =
						err.message?.includes("WEB_SEARCH_ROOT")
							? "WEB_SEARCH_ROOT environment variable is not set. Please set it to your ddg-web-search directory."
							: `Fetch failed: ${err.message}`;

					return {
						content: [{ type: "text", text: message }],
						isError: true,
						details: { url, raw, truncated: false, start_line, end_line } as WebFetchDetails,
					};
				}
			}

			// Apply line selection to the full content
			const lines = fullContent.split("\n");
			let selectedLines: string[];

			if (end_line === -1) {
				// Select from start_line to end
				selectedLines = lines.slice(start_line);
			} else {
				// Select from start_line to end_line (inclusive)
				selectedLines = lines.slice(start_line, end_line + 1);
			}

			const output = selectedLines.join("\n");

			// Truncate if needed
			const truncation = truncateHead(output, {
				maxLines: DEFAULT_MAX_LINES,
				maxBytes: DEFAULT_MAX_BYTES,
			});

			const details: WebFetchDetails = {
				url,
				raw,
				truncated: truncation.truncated,
				start_line,
				end_line,
				isCached: !!cachedResult,
				total_lines: truncation.totalLines,
			};

			let text = truncation.content;
			if (truncation.truncated) {
				text += `\n\n[Output truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)})]`;
			}

			return {
				content: [{ type: "text", text }],
				details,
			};
		},

		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("web_fetch "));
			text += theme.fg("accent", args.url);
			if (args.raw) {
				text += theme.fg("dim", " (raw)");
			}
			if (args.start_line !== 0 || args.end_line !== -1) {
				const start = args.start_line ?? 0;
				const end = args.end_line ?? -1;
				text += theme.fg("dim", ` (lines ${start}-${end})`);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as WebFetchDetails | undefined;

			if (isPartial) {
				return new Text(theme.fg("warning", "Fetching..."), 0, 0);
			}

			if (result.isError) {
				const content = result.content[0];
				const errorMsg = content?.type === "text" ? content.text : "Error";
				return new Text(theme.fg("error", errorMsg), 0, 0);
			}

			const content = result.content[0];
			if (!content || content.type !== "text") {
				return new Text(theme.fg("dim", "No content"), 0, 0);
			}

			const lineCount = content.text.split("\n").length;
			let text = theme.fg("success", `Fetched ${lineCount} lines`);
			if (details?.total_lines !== undefined && details.total_lines !== lineCount) {
				text += theme.fg("dim", ` of ${details.total_lines} total lines`);
			}
			if (details?.truncated) {
				text += theme.fg("warning", " (truncated)");
			}
			if (details?.isCached) {
				text += theme.fg("muted", " (cached)");
			}
			if (details?.start_line !== undefined || details?.end_line !== undefined) {
				const start = details.start_line ?? 0;
				const end = details.end_line ?? -1;
				text += theme.fg("dim", ` (lines ${start}-${end})`);
			}

			if (expanded) {
				const lines = content.text.split("\n").slice(0, 15);
				for (const line of lines) {
					text += `\n${theme.fg("dim", line)}`;
				}
				if (content.text.split("\n").length > 15) {
					text += `\n${theme.fg("muted", "...")}`;
				}
			}

			return new Text(text, 0, 0);
		},
	});
}
