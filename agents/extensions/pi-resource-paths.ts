/**
 * Pi Resource Paths — injects resource conventions into every session
 *
 * Prevents agents from writing to pi's default directories when the user
 * has a custom layout. Provides both convention-based paths (auto-discovered
 * by pi) and custom paths from settings.json.
 *
 * Convention paths (always discovered by pi):
 *   Skills:   ~/.agents/skills/
 *   Prompts:  ~/.agents/prompts/
 *
 * Custom paths come from $PI_CODING_AGENT_DIR/settings.json (extensions, skills, prompts, themes).
 * All paths are resolved dynamically — zero hardcoding.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { SettingsManager } from "@earendil-works/pi-coding-agent";

function resolvePath(raw: string, base: string): string {
  const expanded = raw.startsWith("~")
    ? raw.replace("~", process.env.HOME || "~")
    : raw;
  if (expanded.startsWith("/")) return expanded;
  return `${base}/${expanded}`;
}

function buildContextMessage(ctx: { cwd: string }): string {
  const home = process.env.HOME || "~";
  const agentDir = process.env.PI_CODING_AGENT_DIR;
  const base = agentDir ?? `${home}/.pi/agent`;

  // Convention paths — always discovered by pi
  const lines: string[] = [
    "Global resource paths for this environment:",
    "",
    "Convention paths (auto-discovered by pi — always valid):",
    `  Skills:   ${home}/.agents/skills/`,
    `  Prompts: ${home}/.agents/prompts/`,
  ];

  // Custom paths from settings.json (deduplicated against conventions)
  const settings = SettingsManager.create(ctx.cwd, agentDir);

  const conventionSet = new Set([
    `${home}/.agents/skills`,
    `${home}/.agents/skills/`,
    `${home}/.agents/prompts`,
    `${home}/.agents/prompts/`,
  ]);

  const normalize = (p: string) => p.replace(/\/+$/, "");

  const addCustom = (paths: string[], label: string) => {
    const resolved = paths
      .map((p) => resolvePath(p, base))
      .filter((p) => !conventionSet.has(p) && !conventionSet.has(normalize(p)));
    if (resolved.length) custom.push(`  ${label}: ${resolved.join(", ")}`);
  };

  const custom: string[] = [];
  addCustom(settings.getExtensionPaths(), "Extensions");
  addCustom(settings.getSkillPaths(), "Skills");
  addCustom(settings.getPromptTemplatePaths(), "Prompts");
  addCustom(settings.getThemePaths(), "Themes");

  if (custom.length) {
    lines.push("");
    lines.push("Custom global paths (from settings.json):");
    lines.push(...custom);
  }

  lines.push(
    "",
    "These are GLOBAL paths. Use them for resources shared across all projects.",
    "For project-local resources, use .pi/extensions/ and .agents/skills/ in the project root.",
    "Do NOT use pi's default global directories (~/.pi/agent/extensions/, etc.) unless explicitly listed above.",
  );

  return lines.join("\n");
}

export default function resourcePaths(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (_event, ctx) => {
    const msg = buildContextMessage(ctx);

    return {
      message: {
        customType: "resource-paths",
        content: msg,
        display: false,
      },
    };
  });
}
