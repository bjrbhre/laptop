import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * OpenRouter Usage Extension
 * 
 * Displays daily/weekly/monthly usage in the footer.
 * Auto-updates after each agent turn.
 * 
 * API key resolution order:
 * 1. ~/.pi/agent/auth.json "openrouter" entry
 * 2. OPENROUTER_API_KEY environment variable
 */

interface AuthEntry {
  type: "api_key";
  key: string;
}

interface AuthFile {
  [provider: string]: AuthEntry;
}

interface OpenRouterKeyInfo {
  label: string;
  limit: number | null;
  limit_reset: string | null;
  limit_remaining: number | null;
  include_byok_in_limit: boolean;
  usage: number;
  usage_daily: number;
  usage_weekly: number;
  usage_monthly: number;
  byok_usage: number;
  byok_usage_daily: number;
  byok_usage_weekly: number;
  byok_usage_monthly: number;
  is_free_tier: boolean;
}

interface ExtensionState {
  lastFetched: number | null;
  keyInfo: OpenRouterKeyInfo | null;
  error: string | null;
}

const STATE_KEY = "openrouter-usage-state";
const CAT_EMOJIS = ["🐱", "😺", "😸", "😻", "😼", "😽", "🙀", "😿", "🐈", "🐈‍⬛"];

// Cache for resolved API key (resolved once per process lifetime)
let cachedApiKey: string | null | undefined = undefined;

/**
 * Get the OpenRouter API key from auth.json or environment variable.
 * Resolution order: auth.json -> environment variable
 * 
 * Auth.json key field supports:
 * - Literal value: "sk-or-..."
 * - Environment variable: "MY_VAR_NAME"
 * - Shell command: "!command args"
 */
function getApiKey(): string | null {
  // Return cached value if already resolved
  if (cachedApiKey !== undefined) {
    return cachedApiKey;
  }

  // Try auth.json first
  const authPath = path.join(os.homedir(), ".pi", "agent", "auth.json");
  try {
    if (fs.existsSync(authPath)) {
      const authContent = fs.readFileSync(authPath, "utf-8");
      const auth: AuthFile = JSON.parse(authContent);
      const entry = auth.openrouter;
      
      if (entry && entry.type === "api_key" && entry.key) {
        const key = entry.key;
        
        // Shell command: starts with "!"
        if (key.startsWith("!")) {
          try {
            const result = require("child_process")
              .execSync(key.slice(1), { encoding: "utf-8" })
              .trim();
            cachedApiKey = result || null;
            return cachedApiKey;
          } catch (e) {
            // Fall through to env var
          }
        }
        // Environment variable reference: all caps, no dashes/spaces
        else if (/^[A-Z_][A-Z0-9_]*$/.test(key)) {
          const envValue = process.env[key];
          if (envValue) {
            cachedApiKey = envValue;
            return cachedApiKey;
          }
        }
        // Literal value
        else {
          cachedApiKey = key;
          return cachedApiKey;
        }
      }
    }
  } catch (e) {
    // Ignore parse errors, fall back to env var
  }

  // Fall back to environment variable
  cachedApiKey = process.env.OPENROUTER_API_KEY || null;
  return cachedApiKey;
}

export default function (pi: ExtensionAPI) {
  let state: ExtensionState = {
    lastFetched: null,
    keyInfo: null,
    error: null,
  };

  // Monotonic request id to prevent stale fetch responses from overwriting newer state
  let latestFetchRequestId = 0;

  // Track whether we're using an OpenRouter provider
  let isOpenRouterActive = false;

  function updateOpenRouterStatus(ctx: any) {
    isOpenRouterActive = ctx.model?.provider === "openrouter";
  }

  // Restore state on session start
  pi.on("session_start", async (_event, ctx) => {
    for (const entry of ctx.sessionManager.getEntries()) {
      if (entry.type === "custom" && entry.customType === STATE_KEY) {
        state = entry.data as ExtensionState;
        break;
      }
    }

    // Only fetch/display when using an OpenRouter provider
    updateOpenRouterStatus(ctx);
    if (isOpenRouterActive) {
      await fetchUsage();
      updateFooter(ctx);
    }
  });

  // Update after model change
  pi.on("model_select", async (_event, ctx) => {
    const wasActive = isOpenRouterActive;
    updateOpenRouterStatus(ctx);
    if (isOpenRouterActive) {
      await fetchUsage();
      updateFooter(ctx);
    } else if (wasActive) {
      // Clear footer when switching away from OpenRouter
      ctx.ui.setStatus("openrouter", undefined);
    }
  });

  // Update after each agent turn — fire-and-forget so the footer
  // updates as soon as the network response arrives, not blocking the turn.
  pi.on("agent_end", (_event, ctx) => {
    if (isOpenRouterActive) {
      fetchUsage().then(() => {
        try {
          updateFooter(ctx);
        } catch {
          // Extension ctx may be stale after pi --print session teardown
        }
      });
    }
  });

  async function fetchUsage(): Promise<OpenRouterKeyInfo | null> {
    const requestId = ++latestFetchRequestId;
    const apiKey = getApiKey();
    
    if (!apiKey) {
      // Ignore stale completion if a newer fetch started since this one
      if (requestId !== latestFetchRequestId) {
        return state.keyInfo;
      }

      state.error = "OpenRouter API key not found (check auth.json or OPENROUTER_API_KEY)";
      state.lastFetched = Date.now();
      persistState();
      return null;
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/key", {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // Ignore stale completion if a newer fetch started since this one
      if (requestId !== latestFetchRequestId) {
        return state.keyInfo;
      }

      state.keyInfo = data.data as OpenRouterKeyInfo;
      state.error = null;
      state.lastFetched = Date.now();
      persistState();
      return state.keyInfo;
    } catch (error) {
      // Ignore stale completion if a newer fetch started since this one
      if (requestId !== latestFetchRequestId) {
        return state.keyInfo;
      }

      state.error = error instanceof Error ? error.message : "Failed to fetch";
      state.lastFetched = Date.now();
      persistState();
      return null;
    }
  }

  function persistState() {
    try {
      pi.appendEntry(STATE_KEY, state);
    } catch {
      // Extension ctx may be stale after pi --print session teardown
      // Safely ignore — state is ephemeral footer info
    }
  }

  function formatDollars(dollars: number): string {
    if (dollars >= 1000) {
      return `$${(dollars / 1000).toFixed(1)}K`;
    } else if (dollars >= 1) {
      return `$${dollars.toFixed(2)}`;
    } else {
      return `$${dollars.toFixed(2)}`;
    }
  }

  function getRandomCat(): string {
    return CAT_EMOJIS[Math.floor(Math.random() * CAT_EMOJIS.length)];
  }

  function makeProgressBar(percentage: number, length: number = 10): string {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return "█".repeat(filled) + "░".repeat(empty);
  }

  /**
   * Returns the usage value and label that matches the key's reset frequency.
   * Falls back to daily if limit_reset is null or unrecognised.
   */
  function getPrimaryUsage(keyInfo: OpenRouterKeyInfo): { usage: number; label: string } {
    switch (keyInfo.limit_reset) {
      case "monthly":
        return { usage: keyInfo.usage_monthly, label: "Monthly" };
      case "weekly":
        return { usage: keyInfo.usage_weekly, label: "Weekly" };
      case "daily":
      default:
        return { usage: keyInfo.usage_daily, label: "Daily" };
    }
  }

  function updateFooter(ctx?: any) {
    // Clear any old widget
    if (ctx && ctx.ui) {
      ctx.ui.setWidget("openrouter-usage", undefined);
    } else if (pi.ui) {
      pi.ui.setWidget("openrouter-usage", undefined);
    }
    
    if (!state.keyInfo || state.error) {
      // Show error in footer if there's an issue
      if (ctx && ctx.ui && state.error) {
        ctx.ui.setStatus("openrouter", `❌ ${state.error}`);
      }
      return;
    }
    
    const { keyInfo } = state;
    const parts: string[] = [];
    const { usage, label } = getPrimaryUsage(keyInfo);
    
    // Random cat emoji
    parts.push(getRandomCat());
    
    // Primary period: $2.50 [█████░░░░░] 18%  (label prefix when not daily)
    if (keyInfo.limit !== null) {
      const pct = (usage / keyInfo.limit * 100);
      const bar = makeProgressBar(pct);
      const prefix = keyInfo.limit_reset && keyInfo.limit_reset !== "daily" ? `${label}: ` : "";
      parts.push(`${prefix}${formatDollars(usage)} [${bar}] ${pct.toFixed(0)}%`);
    } else {
      parts.push(`${formatDollars(usage)}`);
    }
    
    // Show the other periods as secondary info (skip the one already shown as primary)
    if (keyInfo.limit_reset !== "monthly") {
      parts.push(`~M:${formatDollars(keyInfo.usage_monthly)}`);
    }
    if (keyInfo.limit_reset !== "weekly") {
      parts.push(`~W:${formatDollars(keyInfo.usage_weekly)}`);
    }
    if (keyInfo.limit_reset !== "daily") {
      parts.push(`~D:${formatDollars(keyInfo.usage_daily)}`);
    }
    
    const statusText = parts.join(" / ");
    
    if (ctx && ctx.ui) {
      ctx.ui.setStatus("openrouter", statusText);
    }
  }

  // Register command for quick usage check
  pi.registerCommand("openrouter-usage", {
    description: "Show OpenRouter API key usage and limits",
    handler: async (_args, ctx) => {
      ctx.ui.notify("Fetching usage from OpenRouter...", "info");
      await fetchUsage();
      
      updateFooter(ctx);
      
      if (state.error) {
        ctx.ui.notify(state.error, "error");
        return;
      }
      
      if (!state.keyInfo) {
        ctx.ui.notify("No API key configured.", "warning");
        return;
      }
      
      ctx.ui.notify("Usage updated in footer", "info");
    },
  });

}