/**
 * Session Namer — short, descriptive names for /resume
 *
 * /namer [name]  generate a name from session content, or set one directly
 * Auto-names unnamed sessions when quitting
 *
 * Design decisions:
 * - LLM call via complete() → zero context pollution (not in agent loop)
 * - setSessionName() → session_info entry, NOT in LLM context
 * - Quit: interactive (1 Enter to accept, Esc to skip, edit freely)
 * - Already named: never re-prompts on shutdown
 * - Non-interactive modes: silently sets name if available
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { complete, getModel } from "@earendil-works/pi-ai/compat";
import {
  Editor,
  type EditorTheme,
  Key,
  matchesKey,
  truncateToWidth,
} from "@earendil-works/pi-tui";

const MAX_NAME = 40;
const PROVIDER = "openrouter";
const MODEL_ID = "z-ai/glm-5.1";

// ── Conversation extraction ──────────────────────────────────────────

function extractText(content: unknown): string[] {
  if (typeof content === "string") return [content];
  if (!Array.isArray(content)) return [];
  return content
    .filter(
      (p): p is { type: "text"; text: string } =>
        p != null &&
        typeof p === "object" &&
        p.type === "text" &&
        typeof p.text === "string",
    )
    .map((p) => p.text);
}

function buildConversationText(
  branch: Array<{
    type: string;
    message?: { role?: string; content?: unknown };
  }>,
): string {
  const parts: string[] = [];
  for (const entry of branch) {
    if (entry.type !== "message" || !entry.message?.role) continue;
    const { role, content } = entry.message;
    if (role !== "user" && role !== "assistant") continue;
    const texts = extractText(content);
    if (!texts.length) continue;
    const label = role === "user" ? "User" : "Asst";
    // Truncate each message to ~200 chars — enough to infer the topic
    const body = texts.join(" ").slice(0, 200).trim();
    if (body) parts.push(`${label}: ${body}`);
  }
  return parts.join("\n");
}

// ── LLM name generation ──────────────────────────────────────────────

function namingPrompt(conversation: string): string {
  return [
    `Give this conversation a very short name (max ${MAX_NAME} characters).`,
    "Capture the main topic or task. Do NOT include the model name.",
    "Reply with ONLY the name — no quotes, no explanation, no trailing period.",
    "",
    "Examples of good names:",
    "  RFC000 Implementation Step 1",
    "  brew packages",
    "  image conversion",
    "  find + cat",
    "  search sessions",
    "",
    "<conversation>",
    conversation,
    "</conversation>",
  ].join("\n");
}

async function generateName(ctx: ExtensionContext, notify: (msg: string) => void): Promise<string | null> {
  const branch = ctx.sessionManager.getBranch();
  notify(`[namer] branch: ${branch.length} entries`);
  const conversation = buildConversationText(branch);
  notify(`[namer] conversation: ${conversation.length} chars`);
  if (!conversation.trim()) {
    notify(`[namer] ✗ empty conversation, aborting`);
    return null;
  }

  const model = getModel(PROVIDER, MODEL_ID);
  if (!model) {
    notify(`[namer] ✗ getModel("${PROVIDER}", "${MODEL_ID}") returned null`);
    return null;
  }
  notify(`[namer] model resolved: ${model.id}`);

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth?.ok) {
    notify(`[namer] ✗ auth failed: ${!auth ? "no auth" : auth.error}`);
    return null;
  }
  notify(`[namer] auth ok (apiKey=${auth.apiKey ? "yes" : "no"}, headers=${auth.headers ? "yes" : "no"}, env=${auth.env ? "yes" : "no"}), calling complete()…`);

  try {
    // Set env vars if provided (some providers use env-based auth)
    const prevEnv: Record<string, string | undefined> = {};
    if (auth.env) {
      for (const [k, v] of Object.entries(auth.env)) {
        prevEnv[k] = process.env[k];
        process.env[k] = v;
      }
    }

    const res = await complete(
      model,
      {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: namingPrompt(conversation.slice(0, 3000)) },
            ],
            timestamp: Date.now(),
          },
        ],
      },
      { apiKey: auth.apiKey, headers: auth.headers },
    );

    // Restore env
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }

    if (res.stopReason === "aborted") {
      notify(`[namer] ✗ complete() aborted`);
      return null;
    }
    notify(`[namer] complete() ok, stopReason=${res.stopReason}`);

    return (
      res.content
        .filter((c: { type: string }) => c.type === "text")
        .map((c: { type: "text"; text: string }) => c.text)
        .join("")
        .trim()
        .replace(/^["'`]+|["'`]+$/g, "")
        .split("\n")[0]!
        .trim()
        .slice(0, MAX_NAME) || null
    );
  } catch (err) {
    notify(`[namer] ✗ complete() threw: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ── Interactive naming UI ─────────────────────────────────────────────

async function nameSession(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  defaultName: string | null,
): Promise<void> {
  if (!ctx.hasUI) {
    if (defaultName) pi.setSessionName(defaultName);
    return;
  }

  const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
    let state: "loading" | "editing" = defaultName ? "editing" : "loading";
    let cancelled = false;
    let cachedLines: string[] | undefined;
    let cachedWidth: number | undefined;

    const editorTheme: EditorTheme = {
      borderColor: (s: string) => theme.fg("accent", s),
      selectList: {
        selectedPrefix: (t: string) => theme.fg("accent", t),
        selectedText: (t: string) => theme.fg("accent", t),
        description: (t: string) => theme.fg("muted", t),
        scrollInfo: (t: string) => theme.fg("dim", t),
        noMatch: (t: string) => theme.fg("warning", t),
      },
    };

    const editor = new Editor(tui, editorTheme);
    if (defaultName) editor.setText(defaultName);
    editor.onSubmit = (value: string) => done(value.trim() || null);

    // Kick off generation if we don't have a name yet
    if (!defaultName) {
      generateName(ctx, (msg) => ctx.ui.notify(msg, "info")).then((name) => {
        if (cancelled) return;
        if (name) editor.setText(name);
        state = "editing";
        cachedWidth = undefined;
        tui.requestRender();
      }).catch(() => {
        if (!cancelled) {
          state = "editing";
          cachedWidth = undefined;
          tui.requestRender();
        }
      });
    }

    return {
      render(width: number): string[] {
        if (cachedLines && cachedWidth === width) return cachedLines;

        const lines: string[] = [];
        const add = (s: string) => lines.push(truncateToWidth(s, width));

        add(theme.fg("accent", "─".repeat(width)));

        if (state === "loading") {
          add(theme.fg("accent", " Generating session name…"));
          add(theme.fg("dim", " Esc to skip"));
        } else {
          add(theme.fg("accent", theme.bold(" Session name")));
          add("");
          for (const line of editor.render(width - 2)) {
            add(` ${line}`);
          }
          add("");
          add(theme.fg("dim", " Enter to accept · Esc to cancel · Edit freely"));
        }

        add(theme.fg("accent", "─".repeat(width)));

        cachedLines = lines;
        cachedWidth = width;
        return lines;
      },

      invalidate(): void {
        cachedWidth = undefined;
        cachedLines = undefined;
        editor.invalidate();
      },

      handleInput(data: string): void {
        if (state === "loading") {
          if (matchesKey(data, Key.escape)) {
            cancelled = true;
            done(null);
          }
          return;
        }
        if (matchesKey(data, Key.escape)) {
          done(null);
          return;
        }
        editor.handleInput(data);
        cachedWidth = undefined;
        tui.requestRender();
      },
    };
  });

  if (result) {
    pi.setSessionName(result);
    ctx.ui.notify(`✓ ${result}`, "info");
  }
}

// ── Extension entry point ────────────────────────────────────────────

export default function sessionNamer(pi: ExtensionAPI) {
  // /name [name] — set or propose a session name
  pi.registerCommand("namer", {
    description: "Generate a smart session name for /resume (usage: /namer [name])",
    handler: async (args, ctx) => {
      const direct = args.trim();
      if (direct) {
        const name = direct.slice(0, MAX_NAME);
        pi.setSessionName(name);
        ctx.ui.notify(`✓ ${name}`, "info");
        return;
      }

      // No args: propose interactively
      // If already named, pre-fill current name (allows renaming)
      await nameSession(pi, ctx, pi.getSessionName());
    },
  });

}
