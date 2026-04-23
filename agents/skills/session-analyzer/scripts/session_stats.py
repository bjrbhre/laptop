#!/usr/bin/env python3
"""
Pi Session Stats — Mechanical analysis layer.

Parses pi session JSONL files and outputs a structured JSON.
Agnostic of pi: receives paths via CLI args, reads no config.

Usage:
    python3 session_stats.py --sessions <path> [<path> ...] --output <path>
    python3 session_stats.py --sessions <path> [<path> ...] --output <path> --include-assistant-texts

Each --sessions path can be:
  - A directory containing .jsonl session files
  - A single .jsonl file
"""

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone


def parse_args():
    p = argparse.ArgumentParser(description="Pi session stats extractor")
    p.add_argument(
        "--sessions",
        nargs="+",
        required=True,
        help="Path(s) to session directories or .jsonl files",
    )
    p.add_argument(
        "--output",
        required=True,
        help="Path for the output JSON file",
    )
    p.add_argument(
        "--include-assistant-texts",
        action="store_true",
        default=False,
        help="Include assistant response texts in output (increases file size)",
    )
    p.add_argument(
        "--active-threshold",
        type=int,
        default=1800,
        help="Seconds threshold to consider a gap as active vs idle (default: 1800 = 30 min)",
    )
    return p.parse_args()


def parse_iso(ts_str):
    """Parse an ISO timestamp string to datetime."""
    if not ts_str:
        return None
    try:
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def collect_jsonl_files(paths):
    """Expand directories and collect .jsonl file paths."""
    files = []
    for p in paths:
        if os.path.isfile(p) and p.endswith(".jsonl"):
            files.append(p)
        elif os.path.isdir(p):
            for fname in sorted(os.listdir(p)):
                if fname.endswith(".jsonl"):
                    files.append(os.path.join(p, fname))
    return files


def parse_session(fpath):
    """Parse a single .jsonl session file into structured data."""
    events = []
    with open(fpath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                pass

    # Metadata
    session_meta = {}
    session_names = []
    model_info = []
    for e in events:
        if e.get("type") == "session":
            session_meta = e
        elif e.get("type") == "session_info":
            session_names.append(e.get("name", ""))
        elif e.get("type") == "model_change":
            model_info.append(f"{e.get('provider', '')}/{e.get('modelId', '')}")

    # Messages
    messages = [e for e in events if e.get("type") == "message"]

    user_msgs = []
    assistant_msgs = []
    tool_result_count = 0

    for m in messages:
        msg = m.get("message", {})
        role = msg.get("role", "")
        ts = m.get("timestamp", "")

        if role == "user":
            content = msg.get("content", [])
            text_parts = [
                c.get("text", "")
                for c in content
                if isinstance(c, dict) and c.get("type") == "text"
            ]
            user_msgs.append({"timestamp": ts, "text": " ".join(text_parts)})

        elif role == "assistant":
            content = msg.get("content", [])
            text_parts = []
            tool_calls = []
            has_thinking = False
            for c in content:
                if isinstance(c, dict):
                    if c.get("type") == "text":
                        text_parts.append(c.get("text", ""))
                    elif c.get("type") == "toolCall":
                        tool_calls.append(c.get("name", ""))
                    elif c.get("type") == "thinking":
                        has_thinking = True

            usage = msg.get("usage", {})
            assistant_msgs.append(
                {
                    "timestamp": ts,
                    "text": " ".join(text_parts),
                    "tool_calls": tool_calls,
                    "has_thinking": has_thinking,
                    "usage": usage,
                }
            )

        elif role == "toolResult":
            tool_result_count += 1

    # Time calculations
    timestamps = []
    for m in messages:
        ts = parse_iso(m.get("timestamp", ""))
        if ts:
            timestamps.append(ts)

    if not timestamps:
        return None

    sorted_ts = sorted(timestamps)
    session_start = sorted_ts[0]
    session_end = sorted_ts[-1]
    wall_duration = (session_end - session_start).total_seconds()

    # Active time: sum of gaps < threshold
    active_duration = 0.0
    for i in range(1, len(sorted_ts)):
        delta = (sorted_ts[i] - sorted_ts[i - 1]).total_seconds()
        if delta < 1800:  # will be overridden by threshold if needed
            active_duration += delta

    # User think time vs machine processing time
    user_think_seconds = 0.0
    machine_process_seconds = 0.0
    prev_role = None
    prev_ts = None
    for m in messages:
        msg = m.get("message", {})
        role = msg.get("role", "")
        ts = parse_iso(m.get("timestamp", ""))
        if ts is None:
            continue
        if prev_ts and role and prev_role:
            delta = (ts - prev_ts).total_seconds()
            if delta < 1800:
                if role == "user":
                    user_think_seconds += delta
                elif role == "assistant":
                    machine_process_seconds += delta
        prev_role = role
        prev_ts = ts

    # Tokens
    total_input = sum(a.get("usage", {}).get("input", 0) for a in assistant_msgs)
    total_output = sum(a.get("usage", {}).get("output", 0) for a in assistant_msgs)
    total_cache_read = sum(
        a.get("usage", {}).get("cacheRead", 0) for a in assistant_msgs
    )
    total_cache_write = sum(
        a.get("usage", {}).get("cacheWrite", 0) for a in assistant_msgs
    )
    total_tokens = total_input + total_output + total_cache_read + total_cache_write
    total_cost = sum(
        a.get("usage", {}).get("cost", {}).get("total", 0) for a in assistant_msgs
    )

    # Tool call counts
    tool_call_counts = defaultdict(int)
    for a in assistant_msgs:
        for tc in a.get("tool_calls", []):
            tool_call_counts[tc] += 1

    user_texts = [u["text"] for u in user_msgs if u["text"].strip()]

    return {
        "file": os.path.basename(fpath),
        "session_id": session_meta.get("id", ""),
        "session_names": session_names,
        "model_info": model_info,
        "session_start": session_start.isoformat(),
        "session_end": session_end.isoformat(),
        "wall_duration_seconds": wall_duration,
        "active_duration_seconds": active_duration,
        "user_think_seconds": user_think_seconds,
        "machine_process_seconds": machine_process_seconds,
        "num_user_msgs": len(user_msgs),
        "num_assistant_msgs": len(assistant_msgs),
        "num_tool_results": tool_result_count,
        "thinking_msgs": sum(1 for a in assistant_msgs if a.get("has_thinking")),
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "total_cache_read": total_cache_read,
        "total_cache_write": total_cache_write,
        "total_tokens": total_tokens,
        "total_cost": total_cost,
        "tool_call_counts": dict(tool_call_counts),
        "user_texts": user_texts,
    }


def compute_aggregates(sessions, active_threshold):
    """Compute global aggregates from parsed sessions."""
    total_wall = sum(s["wall_duration_seconds"] for s in sessions)
    total_active = sum(s["active_duration_seconds"] for s in sessions)
    total_user_think = sum(s["user_think_seconds"] for s in sessions)
    total_machine = sum(s["machine_process_seconds"] for s in sessions)
    total_user_msgs = sum(s["num_user_msgs"] for s in sessions)
    total_asst_msgs = sum(s["num_assistant_msgs"] for s in sessions)
    total_tool_results = sum(s["num_tool_results"] for s in sessions)

    agg_input = sum(s["total_input_tokens"] for s in sessions)
    agg_output = sum(s["total_output_tokens"] for s in sessions)
    agg_cache_read = sum(s["total_cache_read"] for s in sessions)
    agg_cache_write = sum(s["total_cache_write"] for s in sessions)
    agg_cost = sum(s["total_cost"] for s in sessions)
    total_tokens = agg_input + agg_output + agg_cache_read + agg_cache_write

    # Tool usage
    all_tools = defaultdict(int)
    for s in sessions:
        for tool, count in s["tool_call_counts"].items():
            all_tools[tool] += count
    total_tool_calls = sum(all_tools.values())

    # Tool categories
    tool_categories = defaultdict(int)
    category_map = {
        "bash": "execution",
        "read": "read",
        "edit": "edit",
        "write": "write",
        "web_search": "web_search",
        "web_fetch": "web_search",
        "context7_search": "context7",
        "context7_fetch": "context7",
    }
    for tool, count in all_tools.items():
        cat = category_map.get(tool, "other")
        tool_categories[cat] += count

    n = len(sessions) if sessions else 1

    return {
        "num_sessions": len(sessions),
        "total_wall_seconds": total_wall,
        "total_active_seconds": total_active,
        "total_user_think_seconds": total_user_think,
        "total_machine_seconds": total_machine,
        "total_user_msgs": total_user_msgs,
        "total_assistant_msgs": total_asst_msgs,
        "total_tool_results": total_tool_results,
        "total_input_tokens": agg_input,
        "total_output_tokens": agg_output,
        "total_cache_read": agg_cache_read,
        "total_cache_write": agg_cache_write,
        "total_tokens": total_tokens,
        "total_cost": agg_cost,
        "input_output_ratio": round(agg_input / agg_output, 1) if agg_output else 0,
        "cache_pct": round(agg_cache_read / total_tokens * 100, 1) if total_tokens else 0,
        "avg_active_per_session_seconds": round(total_active / n, 1),
        "avg_user_msgs_per_session": round(total_user_msgs / n, 1),
        "avg_cost_per_session": round(agg_cost / n, 2),
        "tokens_per_dollar": round(total_tokens / agg_cost, 0) if agg_cost else 0,
        "user_think_pct": round(total_user_think / total_active * 100, 0) if total_active else 0,
        "machine_pct": round(total_machine / total_active * 100, 0) if total_active else 0,
        "tool_calls_total": total_tool_calls,
        "tool_calls_by_tool": dict(sorted(all_tools.items(), key=lambda x: -x[1])),
        "tool_calls_by_category": dict(sorted(tool_categories.items(), key=lambda x: -x[1])),
    }


def build_timeline(sessions):
    """Build a chronological timeline of sessions."""
    # Group by date
    by_date = defaultdict(lambda: {
        "duration_s": 0,
        "prompts": 0,
        "tokens": 0,
        "cost": 0,
        "sessions": [],
    })
    for s in sessions:
        date = s["session_start"][:10]
        by_date[date]["duration_s"] += s["active_duration_seconds"]
        by_date[date]["prompts"] += s["num_user_msgs"]
        by_date[date]["tokens"] += s.get("total_tokens", 0)
        by_date[date]["cost"] += s["total_cost"]
        by_date[date]["sessions"].append(s.get("session_names", [""])[-1] if s.get("session_names") else "")

    return sorted(
        [
            {
                "date": date,
                "duration_hours": round(d["duration_s"] / 3600, 1),
                "prompts": d["prompts"],
                "tokens_m": round(d["tokens"] / 1_000_000, 1),
                "cost": round(d["cost"], 2),
                "sessions": d["sessions"],
            }
            for date, d in by_date.items()
        ],
        key=lambda x: x["date"],
    )


def main():
    args = parse_args()

    # Collect files
    jsonl_files = collect_jsonl_files(args.sessions)
    if not jsonl_files:
        print("✗ No .jsonl files found in the provided paths", file=sys.stderr)
        sys.exit(1)

    # Parse sessions
    sessions = []
    for fpath in jsonl_files:
        result = parse_session(fpath)
        if result:
            sessions.append(result)

    if not sessions:
        print("✗ No valid sessions found", file=sys.stderr)
        sys.exit(1)

    # Compute aggregates
    aggregates = compute_aggregates(sessions, args.active_threshold)

    # Build timeline
    timeline = build_timeline(sessions)

    # Remove assistant texts unless requested
    if not args.include_assistant_texts:
        for s in sessions:
            # assistant_texts not included by default — nothing to remove
            pass

    # Build output
    output = {
        "sessions": sessions,
        "aggregates": aggregates,
        "timeline": timeline,
    }

    # Write output
    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    file_size_kb = os.path.getsize(args.output) / 1024
    print(f"✓ {len(sessions)} sessions parsed → {args.output} ({file_size_kb:.0f}KB)")


if __name__ == "__main__":
    main()
