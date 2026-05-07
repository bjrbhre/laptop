/**
 * tree_select - Add Space-bar selection to /tree
 *
 * Use /tree-select (or Alt+T) — identical visuals to built-in /tree,
 * but each entry is prefixed with • (included) or ○ (excluded from context).
 * Space toggles the currently highlighted entry.
 *
 * Helper commands: /tree-select-all  /tree-select-clear  /tree-select-status
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { TreeSelectorComponent } from "@mariozechner/pi-coding-agent";
import { truncateToWidth } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";

// IDs of entries the user has explicitly DESELECTED.
// Everything else is included by default.
let deselectedIds = new Set<string>();

// ─── persistence ─────────────────────────────────────────────────────────────

function saveState(pi: ExtensionAPI) {
  pi.appendEntry("tree_select_state", { deselectedIds: Array.from(deselectedIds) });
}

function loadState(ctx: ExtensionContext) {
  deselectedIds.clear();
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "custom" && entry.customType === "tree_select_state") {
      const data = entry.data as { deselectedIds?: string[] } | undefined;
      data?.deselectedIds?.forEach((id) => deselectedIds.add(id));
    }
  }
}

// ─── render wrapper ───────────────────────────────────────────────────────────
// Post-process TreeList's render() output to prepend • / ○ to each entry line.
// The render loop produces exactly (endIndex - startIndex) content lines, then
// one count line.  We replicate the startIndex formula to map line → entry id.

const MARKER_WIDTH = 4; // "[+] " or "[-] "

function patchTreeListRender(treeList: any, theme: Theme) {
  const originalRender = treeList.render.bind(treeList);

  treeList.render = function (width: number): string[] {
    // Call the original with reduced width so total stays within bounds
    const lines: string[] = originalRender(width - MARKER_WIDTH);

    const filteredNodes: any[] = this.filteredNodes;
    if (filteredNodes.length === 0) {
      // No entries — just pad the "no entries" lines
      return lines.map((l) => " ".repeat(MARKER_WIDTH) + l);
    }

    const selectedIndex: number = this.selectedIndex;
    const maxVisibleLines: number = this.maxVisibleLines;
    const startIndex = Math.max(
      0,
      Math.min(
        selectedIndex - Math.floor(maxVisibleLines / 2),
        filteredNodes.length - maxVisibleLines,
      ),
    );
    const endIndex = Math.min(startIndex + maxVisibleLines, filteredNodes.length);
    const contentLineCount = endIndex - startIndex; // lines before the count line

    return lines.map((line, lineIdx) => {
      if (lineIdx >= contentLineCount) {
        // Count / status line — indent without marker
        return " ".repeat(MARKER_WIDTH) + line;
      }
      const entryId: string = filteredNodes[startIndex + lineIdx]?.node?.entry?.id;
      const isDeselected = entryId && deselectedIds.has(entryId);
      const marker = isDeselected
        ? theme.fg("error", "[-] ")
        : theme.fg("success", "[+] ");
      return truncateToWidth(marker + line, width);
    });
  };
}

// ─── tree-select UI ───────────────────────────────────────────────────────────

async function showTreeSelect(pi: ExtensionAPI, ctx: ExtensionContext) {
  const tree   = ctx.sessionManager.getTree();
  const leafId = ctx.sessionManager.getLeafId();

  if (tree.length === 0) {
    ctx.ui.notify("Session is empty", "warning");
    return;
  }

  const navigateTo = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
    const selector = new TreeSelectorComponent(
      tree,
      leafId,
      tui.terminal.rows,
      (entryId) => done(entryId),
      () => done(null),
      (entryId, label) => pi.setLabel(entryId, label),
    );

    const treeList = (selector as any).treeList;
    patchTreeListRender(treeList, theme);

    return {
      render      : (w: number) => selector.render(w),
      invalidate  : ()  => selector.invalidate(),
      handleInput : (data: string) => {
        if (data === " ") {
          const node = treeList.getSelectedNode();
          if (node) {
            const id: string = node.entry.id;
            if (deselectedIds.has(id)) {
              deselectedIds.delete(id);
            } else {
              deselectedIds.add(id);
            }
            saveState(pi);
            tui.requestRender();
          }
          return true;
        }
        selector.handleInput(data);
        tui.requestRender();
        return true;
      },
    };
  });

  if (navigateTo) {
    await ctx.navigateTree(navigateTo);
  }
}

// ─── extension entry point ────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {

  const restore = (ctx: ExtensionContext) => loadState(ctx);

  pi.on("session_start", async (_e, ctx) => restore(ctx));
  pi.on("session_tree",  async (_e, ctx) => restore(ctx));
  pi.on("session_fork",  async (_e, ctx) => restore(ctx));

  // ── /tree-select command ──────────────────────────────────────────────────
  pi.registerCommand("tree-select", {
    description: "Tree navigator with Space-bar selection (• = included, ○ = excluded from context)",
    handler: async (_args, ctx) => {
      await ctx.waitForIdle();
      await showTreeSelect(pi, ctx);
    },
  });

  // ── Alt+T shortcut ────────────────────────────────────────────────────────
  pi.registerShortcut("alt+t", {
    description: "Open tree-select navigator",
    handler: async (ctx) => { await showTreeSelect(pi, ctx as any); },
  });

  // ── context filter ────────────────────────────────────────────────────────
  pi.on("context", async (event, ctx) => {
    if (deselectedIds.size === 0) return;

    const excluded = new Set<object>();
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "message" && deselectedIds.has(entry.id)) {
        excluded.add(entry.message as object);
      }
    }

    return { messages: event.messages.filter((m) => !excluded.has(m as object)) };
  });

  // ── helper commands ───────────────────────────────────────────────────────
  pi.registerCommand("tree-select-all", {
    description: "Re-select all entries (clear all deselections)",
    handler: async (_args, ctx) => {
      const n = deselectedIds.size;
      deselectedIds.clear();
      saveState(pi);
      ctx.ui.notify(`Re-selected ${n} entr${n === 1 ? "y" : "ies"} — all messages sent to model`, "success");
    },
  });

  pi.registerCommand("tree-select-clear", {
    description: "Deselect all entries",
    handler: async (_args, ctx) => {
      const entries = ctx.sessionManager.getEntries();
      entries.forEach((e) => deselectedIds.add(e.id));
      saveState(pi);
      ctx.ui.notify(`Deselected ${entries.length} entries`, "info");
    },
  });

  pi.registerCommand("tree-select-status", {
    description: "Show how many entries are selected vs excluded",
    handler: async (_args, ctx) => {
      const total = ctx.sessionManager.getEntries().length;
      const excl  = deselectedIds.size;
      ctx.ui.notify(`${total - excl}/${total} selected  (${excl} excluded from context)`, "info");
    },
  });
}
