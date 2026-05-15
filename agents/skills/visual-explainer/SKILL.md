---
name: visual-explainer
description: Generate self-contained HTML pages that visually explain systems, code changes, plans, and data. Use when the user asks for a diagram, architecture overview, diff review, plan review, project recap, comparison table, or any visual explanation. Also use proactively for ASCII tables with 4+ rows or 3+ columns.
license: MIT
metadata:
  author: nicobailon
  trimmed_by: pbeauhaire
  version: "0.4.2-trimmed"
  note: >
    Trimmed from the original 409-line SKILL.md. Aesthetic rules, forbidden
    patterns, slide deck specs, and Mermaid theming details moved to
    references/ for progressive disclosure. Core workflow (decide → structure
    → style → deliver) and quick-check anti-patterns retained in SKILL.md.
---

# Visual Explainer

Generate self-contained HTML files for technical diagrams and visualizations. Always open the result in the browser. Never fall back to ASCII art.

## Workflow

### 1. Decide

Pick content type → aesthetic → rendering approach. Commit before writing HTML.

**Content types:** Architecture, flowchart, sequence, data flow, ER/schema, state machine, mind map, data table, timeline, dashboard, prose page.

**Aesthetics** (pick one, vary each time):
- **Blueprint** — technical grid, deep slate/blue, monospace labels
- **Editorial** — serif headlines, generous whitespace, muted earth/navy+gold
- **Paper/ink** — warm cream `#faf7f5`, terracotta/sage accents
- **Terminal mono** — green/amber on near-black, monospace everything
- **IDE-inspired** — pick a real named scheme (Dracula, Nord, Catppuccin, Solarized, Gruvbox, Rosé Pine) and commit to its actual palette

**Forbidden aesthetics:** neon dashboard (cyan+magenta+purple), gradient mesh, Inter+indigo/violet accents, gradient text on headings.

### 2. Structure

Read the right reference/template before generating:
- Text-heavy architecture → `./templates/architecture.html`
- Flowcharts/sequence/ER/state/mind map → `./templates/mermaid-flowchart.html`
- Data tables/comparisons → `./templates/data-table.html`
- Slide decks → `./templates/slide-deck.html` + `./references/slide-patterns.md`
- Prose pages → "Prose Page Elements" in `./references/css-patterns.md`

For CSS/layout patterns, SVG connectors, and forbidden patterns: `./references/css-patterns.md`
For fonts, libraries, Mermaid theming: `./references/libraries.md`
For 4+ section pages with nav: `./references/responsive-nav.md`

**Rendering approach:**

| Content | Approach | Why |
|---------|----------|-----|
| Architecture (text-heavy) | CSS Grid cards + arrows | Rich card content needs CSS |
| Architecture (topology) | Mermaid | Auto edge routing |
| Flowchart/pipeline | Mermaid | Auto layout |
| Sequence | Mermaid | Lifelines need auto layout |
| Data flow, ER, state, mind map | Mermaid | Connections need routing |
| Data table | HTML `<table>` | Semantic, accessible, copy-paste |
| Timeline | CSS (central line + cards) | Simple linear |
| Dashboard | CSS Grid + Chart.js | Card grid with charts |

### 3. Style — Quick Rules

- **Fonts:** Pick from pairings in `./references/libraries.md`. Forbidden as `--font-body`: Inter, Roboto, Arial, Helvetica, system-ui alone.
- **Colors:** CSS custom properties for `--bg`, `--surface`, `--border`, `--text`, `--text-dim`, 3-5 accents. Support both themes. Forbidden accents: `#8b5cf6`, `#7c3aed`, `#a78bfa`, `#d946ef`, cyan-magenta combos.
- **Surfaces:** Subtle depth shifts (2-4% lightness), low-opacity borders. Not everything should pop.
- **Backgrounds:** Subtle gradients or grid patterns. Not flat, not neon blobs.
- **Animation:** Staggered fade-ins on load = good. Glowing box-shadows, pulsing, continuous animations = forbidden. Respect `prefers-reduced-motion`.
- **No emoji in headers.** Use styled monospace labels or numbered badges.

### 4. Deliver

Write to `~/Downloads/`. Open in browser (`open` on macOS, `xdg-open` on Linux). Tell user the path.

## Anti-Patterns (Quick Check)

Before delivering, verify:
1. Not Inter/Roboto + purple/violet gradient
2. No gradient text on headings
3. No emoji section headers
4. No glowing cards
5. No cyan-magenta-pink neon
6. No uniform card grid with no hierarchy
7. No three-dot code block chrome
8. No `overflow` issues — every grid/flex child needs `min-width: 0`
9. Mermaid diagrams have zoom controls (+/−/reset, scroll-zoom, drag-pan)
10. Both light and dark themes look intentional