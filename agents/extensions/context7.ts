/**
 * Context7 Extension
 *
 * Provides tools to fetch up-to-date library documentation and code examples
 * via the Context7 API. No more outdated training data or hallucinated APIs.
 *
 * Requires CONTEXT7_API_KEY environment variable.
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

// Tool parameter schemas
const Context7SearchParams = Type.Object({
	query: Type.String({ description: "Your question or task (used for relevance ranking)" }),
	libraryName: Type.String({ description: "The library name to search for (e.g., 'react', 'nextjs')" }),
});

const Context7FetchParams = Type.Object({
	query: Type.String({ description: "Your question or task (determines which docs are returned)" }),
	libraryId: Type.String({ description: "Context7 library ID from search results (e.g., '/facebook/react')" }),
});

// Details types for rendering
interface Context7SearchDetails {
	query: string;
	libraryName: string;
	resultCount: number;
	truncated?: boolean;
}

interface Context7FetchDetails {
	query: string;
	libraryId: string;
	truncated?: boolean;
}

// API base URL
const API_BASE = "https://context7.com/api/v2";

// Get the API key
function getApiKey(): string | null {
	return process.env.CONTEXT7_API_KEY ?? null;
}

// Make an API request
async function apiRequest(
	pi: ExtensionAPI,
	endpoint: string,
	params: Record<string, string>,
): Promise<{ data: string; error?: string }> {
	const apiKey = getApiKey();
	if (!apiKey) {
		return { data: "", error: "CONTEXT7_API_KEY environment variable is not set" };
	}

	const url = new URL(`${API_BASE}${endpoint}`);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}

	try {
		const result = await pi.exec("curl", [
			"-s",
			"-H",
			`Authorization: Bearer ${apiKey}`,
			url.toString(),
		]);

		if (result.code !== 0) {
			return { data: "", error: result.stderr || `Request failed with code ${result.code}` };
		}

		return { data: result.stdout };
	} catch (err: any) {
		return { data: "", error: err.message };
	}
}

export default function (pi: ExtensionAPI) {
	// Warn on startup if API key is not set
	pi.on("session_start", async (_event, ctx) => {
		if (!getApiKey()) {
			ctx.ui.notify(
				"context7: CONTEXT7_API_KEY not set. Get one at context7.com",
				"warning",
			);
		}
	});

	// Register context7_search tool
	pi.registerTool({
		name: "context7_search",
		label: "Context7 Search",
		description: `Search for a library on Context7 to get its ID for fetching documentation. Returns matching libraries with IDs, descriptions, and trust scores. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}.`,
		promptSnippet: "Get more information about any coding library",
		promptGuidelines: [
			"Call context7_search to search for exact library names",
		],
		parameters: Context7SearchParams,
		prepareArguments(args) {
			if (!args || typeof args !== "object") return args;
			const input = args as Record<string, any>;
			return {
				...input,
				libraryName: input.libraryName || "",
				query: input.query || ""
			};
		},

		async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
			let { query, libraryName } = params;
			query = query || "";
			libraryName = libraryName || "";

			if (signal?.aborted) {
				return {
					content: [{ type: "text", text: "Search cancelled" }],
					isError: true,
				};
			}

			const { data, error } = await apiRequest(pi, "/libs/search", {
				query,
				libraryName,
			});

			if (error) {
				return {
					content: [{ type: "text", text: error }],
					isError: true,
					details: { query, libraryName, resultCount: 0 } as Context7SearchDetails,
				};
			}

			try {
				// Parse and format the JSON response
				const response = JSON.parse(data);

				// API returns {"results": [...]}
				const libraries = response.results || response;

				if (!Array.isArray(libraries) || libraries.length === 0) {
					return {
						content: [{ type: "text", text: "No libraries found" }],
						details: { query, libraryName, resultCount: 0 } as Context7SearchDetails,
					};
				}

				// Format as readable text
				let output = `Found ${libraries.length} libraries:\n\n`;
				for (const lib of libraries) {
					output += `**${lib.title || lib.name}**\n`;
					output += `  ID: ${lib.id}\n`;
					if (lib.description) {
						output += `  ${lib.description}\n`;
					}
					if (lib.trustScore !== undefined) {
						output += `  Trust Score: ${lib.trustScore}`;
						if (lib.verified) output += " ✓ Verified";
						output += "\n";
					}
					output += "\n";
				}

				// Truncate if needed
				const truncation = truncateHead(output, {
					maxLines: DEFAULT_MAX_LINES,
					maxBytes: DEFAULT_MAX_BYTES,
				});

				const details: Context7SearchDetails = {
					query,
					libraryName,
					resultCount: libraries.length,
					truncated: truncation.truncated,
				};

				let text = truncation.content;
				if (truncation.truncated) {
					text += `\n\n[Output truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines]`;
				}

				return {
					content: [{ type: "text", text }],
					details,
				};
			} catch (parseErr: any) {
				return {
					content: [{ type: "text", text: `Failed to parse response: ${parseErr.message}\n\nRaw response:\n${data}` }],
					isError: true,
					details: { query, libraryName, resultCount: 0 } as Context7SearchDetails,
				};
			}
		},

		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("context7_search "));
			text += theme.fg("accent", `"${args.libraryName || ""}"`);
			const queryStr = args.query || "";
			text += theme.fg("dim", ` for "${queryStr.slice(0, 30)}${queryStr.length > 30 ? "..." : ""}"`);
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as Context7SearchDetails | undefined;

			if (isPartial) {
				return new Text(theme.fg("warning", "Searching..."), 0, 0);
			}

			if (result.isError) {
				const content = result.content[0];
				const errorMsg = content?.type === "text" ? content.text.slice(0, 100) : "Error";
				return new Text(theme.fg("error", errorMsg), 0, 0);
			}

			if (!details || details.resultCount === 0) {
				return new Text(theme.fg("dim", "No libraries found"), 0, 0);
			}

			let text = theme.fg("success", `${details.resultCount} libraries found`);
			if (details.truncated) {
				text += theme.fg("warning", " (truncated)");
			}

			if (expanded) {
				const content = result.content[0];
				if (content?.type === "text") {
					const lines = content.text.split("\n").slice(0, 15);
					for (const line of lines) {
						text += `\n${theme.fg("dim", line)}`;
					}
					if (content.text.split("\n").length > 15) {
						text += `\n${theme.fg("muted", "...")}`;
					}
				}
			}

			return new Text(text, 0, 0);
		},
	});

	// Register context7_fetch tool
	pi.registerTool({
		name: "context7_fetch",
		label: "Context7 Fetch",
		description: `Fetch up-to-date documentation for a library. Returns markdown-formatted docs relevant to your query. Use after context7_search to get the library ID. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}.`,
		promptSnippet: "Fetch documentation for any coding library",
		promptGuidelines: [
			"Call context7_fetch to fetch detailed information about a library on specific topics based on query",
		],
		parameters: Context7FetchParams,
		prepareArguments(args) {
			if (!args || typeof args !== "object") return args;
			const input = args as Record<string, any>;
			return {
				...input,
				libraryId: input.libraryId || "",
				query: input.query || ""
			};
		},

		async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
			let { query, libraryId } = params;
			query = query || "";
			libraryId = libraryId || "";

			if (signal?.aborted) {
				return {
					content: [{ type: "text", text: "Fetch cancelled" }],
					isError: true,
				};
			}

			const { data, error } = await apiRequest(pi, "/context", {
				query,
				libraryId,
			});

			if (error) {
				return {
					content: [{ type: "text", text: error }],
					isError: true,
					details: { query, libraryId, truncated: false } as Context7FetchDetails,
				};
			}

			if (!data.trim()) {
				return {
					content: [{ type: "text", text: "No documentation found for this query" }],
					details: { query, libraryId, truncated: false } as Context7FetchDetails,
				};
			}

			// Truncate if needed
			const truncation = truncateHead(data, {
				maxLines: DEFAULT_MAX_LINES,
				maxBytes: DEFAULT_MAX_BYTES,
			});

			const details: Context7FetchDetails = {
				query,
				libraryId,
				truncated: truncation.truncated,
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
			let text = theme.fg("toolTitle", theme.bold("context7_fetch "));
			text += theme.fg("accent", args.libraryId || "");
			const queryStr = args.query || "";
			text += theme.fg("dim", ` for "${queryStr.slice(0, 30)}${queryStr.length > 30 ? "..." : ""}"`);
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as Context7FetchDetails | undefined;

			if (isPartial) {
				return new Text(theme.fg("warning", "Fetching docs..."), 0, 0);
			}

			if (result.isError) {
				const content = result.content[0];
				const errorMsg = content?.type === "text" ? content.text.slice(0, 100) : "Error";
				return new Text(theme.fg("error", errorMsg), 0, 0);
			}

			const content = result.content[0];
			if (!content || content.type !== "text") {
				return new Text(theme.fg("dim", "No content"), 0, 0);
			}

			const lineCount = content.text.split("\n").length;
			let text = theme.fg("success", `Fetched ${lineCount} lines`);
			if (details?.truncated) {
				text += theme.fg("warning", " (truncated)");
			}

			if (expanded) {
				const lines = content.text.split("\n").slice(0, 20);
				for (const line of lines) {
					text += `\n${theme.fg("dim", line)}`;
				}
				if (content.text.split("\n").length > 20) {
					text += `\n${theme.fg("muted", "...")}`;
				}
			}

			return new Text(text, 0, 0);
		},
	});
}
