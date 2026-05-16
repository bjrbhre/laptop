import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Cortecs Usage Extension
 *
 * Displays account balance from the Cortecs Management API in the footer.
 * Auto-updates after each agent turn when using a Cortecs model.
 *
 * If CORTECS_SPENDING_CAP is set, shows a progress bar of consumed budget.
 *
 * Management API key resolution order:
 * 1. CORTECS_MANAGEMENT_KEY environment variable
 * 2. ~/.pi/agent/auth.json "cortecs-management" entry
 * 3. CORTECS_API_KEY environment variable (fallback, may not have management permissions)
 */

interface AuthEntry {
	type: "api_key";
	key: string;
}

interface AuthFile {
	[provider: string]: AuthEntry;
}

interface CortecsBalanceResponse {
	current_balance: number;
	currency: string;
}

interface ExtensionState {
	lastFetched: number | null;
	balance: CortecsBalanceResponse | null;
	error: string | null;
}

const STATE_KEY = "cortecs-usage-state";
const MANAGE_BASE_URL = "https://api.cortecs.ai/v1/manage";

let cachedManagementKey: string | null | undefined = undefined;

function getManagementKey(): string | null {
	if (cachedManagementKey !== undefined) {
		return cachedManagementKey;
	}

	const envMgmtKey = process.env.CORTECS_MANAGEMENT_KEY;
	if (envMgmtKey) {
		cachedManagementKey = envMgmtKey;
		return cachedManagementKey;
	}

	const authPath = path.join(os.homedir(), ".pi", "agent", "auth.json");
	try {
		if (fs.existsSync(authPath)) {
			const auth: AuthFile = JSON.parse(fs.readFileSync(authPath, "utf-8"));
			const entry = auth["cortecs-management"];
			if (entry?.type === "api_key" && entry.key) {
				const key = entry.key;
				if (key.startsWith("!")) {
					try {
						cachedManagementKey = require("child_process")
							.execSync(key.slice(1), { encoding: "utf-8" })
							.trim() || null;
						return cachedManagementKey;
					} catch { /* fall through */ }
				} else if (/^[A-Z_][A-Z0-9_]*$/.test(key)) {
					if (process.env[key]) {
						cachedManagementKey = process.env[key];
						return cachedManagementKey;
					}
				} else {
					cachedManagementKey = key;
					return cachedManagementKey;
				}
			}
		}
	} catch { /* ignore */ }

	const inferenceKey = process.env.CORTECS_API_KEY;
	if (inferenceKey) {
		cachedManagementKey = inferenceKey;
		return cachedManagementKey;
	}

	cachedManagementKey = null;
	return cachedManagementKey;
}

export default function (pi: ExtensionAPI) {
	let state: ExtensionState = {
		lastFetched: null,
		balance: null,
		error: null,
	};

	let latestFetchRequestId = 0;
	let isCortecsActive = false;

	pi.on("session_start", async (_event, ctx) => {
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type === "custom" && entry.customType === STATE_KEY) {
				state = entry.data as ExtensionState;
				break;
			}
		}

		updateCortecsStatus(ctx);
		if (isCortecsActive) {
			await fetchBalance();
			updateFooter(ctx);
		}
	});

	pi.on("model_select", async (_event, ctx) => {
		updateCortecsStatus(ctx);
		if (isCortecsActive) {
			await fetchBalance();
			updateFooter(ctx);
		} else {
			ctx.ui.setStatus("usage-cortecs", undefined);
		}
	});

	pi.on("agent_end", (_event, ctx) => {
		if (isCortecsActive) {
			fetchBalance().then(() => updateFooter(ctx));
		}
	});

	function updateCortecsStatus(ctx: any) {
		isCortecsActive = ctx.model?.provider === "cortecs";
	}

	async function fetchBalance(): Promise<CortecsBalanceResponse | null> {
		const requestId = ++latestFetchRequestId;
		const apiKey = getManagementKey();

		if (!apiKey) {
			if (requestId !== latestFetchRequestId) return state.balance;
			state.error = "No Cortecs API key found (set CORTECS_MANAGEMENT_KEY or CORTECS_API_KEY)";
			state.lastFetched = Date.now();
			persistState();
			return null;
		}

		try {
			const response = await fetch(`${MANAGE_BASE_URL}/users/balance`, {
				headers: {
					Authorization: `Bearer ${apiKey}`,
					Accept: "*/*",
				},
			});

			if (!response.ok) {
				let errorMsg = `HTTP ${response.status}`;
				if (response.status === 403) {
					errorMsg = "Requires management API key (set CORTECS_MANAGEMENT_KEY)";
				} else {
					try {
						const e = JSON.parse(await response.text());
						if (e.error) errorMsg = e.error;
					} catch { /* ignore */ }
				}
				throw new Error(errorMsg);
			}

			const raw = (await response.json()) as any;
			const data: CortecsBalanceResponse = raw?.data ?? raw;

			if (typeof data.current_balance !== "number" || !Number.isFinite(data.current_balance)) {
				throw new Error(`Invalid balance response: ${JSON.stringify(raw).slice(0, 200)}`);
			}

			if (requestId !== latestFetchRequestId) return state.balance;

			state.balance = data;
			state.error = null;
			state.lastFetched = Date.now();
			persistState();
			return state.balance;
		} catch (error) {
			if (requestId !== latestFetchRequestId) return state.balance;
			state.error = error instanceof Error ? error.message : "Failed to fetch";
			state.lastFetched = Date.now();
			persistState();
			return null;
		}
	}

	function persistState() {
		pi.appendEntry(STATE_KEY, state);
	}

	function formatCurrency(amount: number, currency: string): string {
		const fmt = (n: number) => n.toFixed(2);
		const fmtK = (n: number) => `${(n / 1000).toFixed(1)}K`;
		const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency === "GBP" ? "£" : ` ${currency}`;
		if (currency === "USD" || currency === "GBP") {
			return amount >= 1000 ? `${sym}${fmtK(amount)}` : `${sym}${fmt(amount)}`;
		}
		return amount >= 1000 ? `${fmtK(amount)}${sym}` : `${fmt(amount)}${sym}`;
	}

	function makeProgressBar(pct: number, length = 10): string {
		const filled = Math.round((pct / 100) * length);
		return "█".repeat(filled) + "░".repeat(length - filled);
	}

	function getSpendingCap(): number | null {
		const envCap = process.env.CORTECS_SPENDING_CAP;
		if (envCap) {
			const v = parseFloat(envCap);
			if (Number.isFinite(v) && v > 0) return v;
		}
		const authPath = path.join(os.homedir(), ".pi", "agent", "auth.json");
		try {
			if (fs.existsSync(authPath)) {
				const entry = JSON.parse(fs.readFileSync(authPath, "utf-8"))["cortecs-spending-cap"];
				const v = typeof entry === "number" ? entry : typeof entry === "string" ? parseFloat(entry) : NaN;
				if (Number.isFinite(v) && v > 0) return v;
			}
		} catch { /* ignore */ }
		return null;
	}

	function updateFooter(ctx?: any) {
		if (!isCortecsActive) return;

		if (state.error) {
			if (state.error.includes("Requires management API key")) {
				ctx?.ui?.setStatus("usage-cortecs", undefined);
			} else {
				ctx?.ui?.setStatus("usage-cortecs", `❌ ${state.error}`);
			}
			return;
		}

		if (!state.balance) return;

		const { current_balance, currency } = state.balance;
		const cap = getSpendingCap();
		const parts: string[] = ["💳"];

		if (cap != null) {
			const spent = cap - current_balance;
			const spentPct = Math.min(100, Math.max(0, (spent / cap) * 100));
			parts.push(`${formatCurrency(Math.max(0, spent), currency)} [${makeProgressBar(spentPct)}] ${spentPct.toFixed(0)}%`);
			if (current_balance > 0) {
				parts.push(`~${formatCurrency(current_balance, currency)} left`);
			} else {
				parts.push("cap reached");
			}
		} else {
			parts.push(formatCurrency(current_balance, currency));
		}

		ctx?.ui?.setStatus("usage-cortecs", parts.join(" "));
	}

	pi.registerCommand("cortecs-balance", {
		description: "Show Cortecs account balance",
		handler: async (_args, ctx) => {
			if (!isCortecsActive) {
				ctx.ui.notify("Not using a Cortecs model", "warning");
				return;
			}

			ctx.ui.notify("Fetching Cortecs balance...", "info");
			await fetchBalance();
			updateFooter(ctx);

			if (state.error) {
				ctx.ui.notify(
					state.error.includes("Requires management API key")
						? "This requires a Cortecs management API key.\nSet CORTECS_MANAGEMENT_KEY or add a 'cortecs-management' entry to ~/.pi/agent/auth.json"
						: state.error,
					"error",
				);
				return;
			}

			if (!state.balance) {
				ctx.ui.notify("No balance data available", "warning");
				return;
			}

			const { current_balance, currency } = state.balance;
			const cap = getSpendingCap();

			if (cap != null) {
				const spent = Math.max(0, cap - current_balance);
				const remaining = Math.max(0, current_balance);
				ctx.ui.notify(
					`Cortecs balance: ${formatCurrency(current_balance, currency)}\n` +
					`Spent: ${formatCurrency(spent, currency)} / ${formatCurrency(cap, currency)}\n` +
					`Remaining: ${formatCurrency(remaining, currency)}`,
					"info",
				);
			} else {
				ctx.ui.notify(`Cortecs balance: ${formatCurrency(current_balance, currency)}`, "info");
			}
		},
	});
}
