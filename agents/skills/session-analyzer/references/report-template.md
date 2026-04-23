# Report Template

This template defines the expected structure for session analysis reports.
Adapt depth and sections based on the number of sessions and data richness.

## Structure

1. **Overview** — table with key metrics (sessions count, period, active time, prompts, tokens, cost)
2. **Time: User vs Machine** — breakdown of active time, who spends time where, bottleneck analysis
3. **Tokens & Costs** — input/output/cache breakdown, ratios, cost efficiency
4. **Session Details** — compact table with all sessions: topic, date, duration (h), tokens (M), cost. Include a **Total** row. Followed by one subsection per session with tools and focus summary
5. **Tools — Aggregation** — by tool and by category, with percentages
6. **Regulatory/Thematic Analysis** — identify themes from user_texts content (NOT hardcoded keywords)
7. **Macro-Tasks by Type** — classify sessions by what the user *did*
8. **Operational Efficiency** — averages, ratios, tokens per dollar
9. **Session Timeline** — chronological table with: date, duration (h), prompts, tokens (M), cost, themes. Include a **Total** row
10. **Key Takeaways** — 8-10 actionable insights with narrative

## Style

- Tables for structured data, prose for interpretation
- Keep numbers in tables, meaning in prose
- Use emoji sparingly for section markers
- Bilingual: match the user's language for the report, keep technical terms in English
- Honest about thin data — don't over-interpret 1-2 sessions

## Example Report

See the secu-compliance report in `$PI_CODING_AGENT_DIR/sessions-analysis/` if it exists, or ask the user to point to a previous report.
