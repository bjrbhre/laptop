#!/usr/bin/env python3
"""
Search pi coding agent sessions by content, file produced, or name.

Usage:
    python3 search.py --sessions ~/.config/pi/sessions --query "DORA" --mode all
    python3 search.py --sessions ~/.config/pi/sessions --query "Review Victor C" --mode file-written
    python3 search.py --sessions ~/.config/pi/sessions --query "fetch" --mode name --limit 5

Options:
    --sessions <path>       Path to sessions directory (required)
    --query <string>        Search query (required)
    --mode <mode>           Search mode: content, file-written, name, all (default: all)
    --limit <N>             Max results (default: 10)
    --include-user-texts    Include first user messages in output
    --include-tool-paths    Include file paths from write/edit calls
"""

import argparse
import glob
import json
import os
import re
import sys
from collections import Counter


HOME = os.path.expanduser("~")


def compact_cwd(cwd: str) -> str:
    """Compact cwd for display: ~/ for home, ~/Code/... for subdirs."""
    if cwd.startswith(HOME + "/"):
        return "~/" + cwd[len(HOME) + 1:]
    if cwd == HOME:
        return "~/"
    return cwd

# --- Stop words (FR + EN) ---
STOP_WORDS = frozenset({
    # English
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "must", "to", "of",
    "in", "for", "on", "with", "at", "by", "from", "as", "into", "through",
    "during", "before", "after", "above", "below", "between", "out", "off",
    "over", "under", "again", "further", "then", "once", "here", "there",
    "when", "where", "why", "how", "all", "each", "every", "both", "few",
    "more", "most", "other", "some", "such", "no", "nor", "not", "only",
    "own", "same", "so", "than", "too", "very", "just", "because", "but",
    "and", "or", "if", "while", "about", "up", "this", "that", "these",
    "those", "it", "its", "i", "me", "my", "we", "us", "our", "you", "your",
    "he", "him", "his", "she", "her", "they", "them", "their", "what",
    "which", "who", "whom",
    # French
    "le", "la", "les", "un", "une", "des", "de", "du", "au", "aux",
    "en", "dans", "sur", "avec", "pour", "par", "est", "sont", "suis",
    "ai", "as", "avons", "ont", "fait", "être", "avoir", "qui", "que",
    "quoi", "comment", "où", "quand", "pourquoi", "ce", "cette", "ces",
    "celui", "celle", "ceux", "elles", "il", "elle", "nous", "vous",
    "on", "mais", "ou", "et", "donc", "car", "si", "comme", "tout",
    "tous", "toute", "toutes", "même", "aussi", "encore", "bien",
    "très", "plus", "moins", "autre", "autres", "aucun", "aucune",
    "chaque", "certain", "plusieurs", "quelque", "quelques", "sans",
    # Noise
    "yes", "no", "ok", "okay", "please", "thanks", "thank",
})


def extract_significant_words(texts: list[str], max_words: int = 5) -> str:
    """Extract 3-5 significant words from a list of texts."""
    words = []
    for text in texts:
        # Split on non-alpha, keep words >= 3 chars
        tokens = re.findall(r"[a-zA-ZÀ-ÿ]{3,}", text)
        for w in tokens:
            wl = w.lower()
            if wl not in STOP_WORDS and len(wl) >= 3:
                words.append(wl)

    if not words:
        return ""

    counter = Counter(words)
    top = [w for w, _ in counter.most_common(max_words)]
    return " ".join(top)


def is_name_descriptive(name: str) -> bool:
    """Check if a session name is descriptive enough to stand alone."""
    if not name or len(name) < 5:
        return False
    # Shell artifacts
    if name.endswith("$") or name.startswith("#"):
        return False
    # Too short or generic
    generics = {"demo", "test", "tmp", "temp", "analyse", "analysis"}
    if name.lower().strip() in generics:
        return False
    return True


def compute_summary(name: str, user_texts: list[str]) -> str:
    """Generate a heuristic session summary."""
    if is_name_descriptive(name):
        return ""  # Name is already good, no summary needed

    if not user_texts or len(user_texts) < 1:
        return "session courte / incomplète"

    summary = extract_significant_words(user_texts[:3], max_words=5)
    return summary if summary else "session courte / incomplète"


def search_sessions(sessions_dir: str, query: str, mode: str, limit: int,
                    include_user_texts: bool, include_tool_paths: bool) -> dict:
    """Search across session files and return structured results."""

    query_lower = query.lower()
    results = []

    jsonl_files = sorted(glob.glob(os.path.join(sessions_dir, "**", "*.jsonl"), recursive=True))

    for filepath in jsonl_files:
        session_data = {
            "session_name": "",
            "session_summary": "",
            "session_folder": os.path.basename(os.path.dirname(filepath)),
            "session_file": os.path.basename(filepath),
            "session_timestamp": "",
            "session_cwd": "",
            "session_cwd_compact": "",
            "match_reasons": [],
            "files_written": [],
            "user_texts": [],
        }

        user_texts_raw = []
        files_written = []
        name_history = []
        name_match = False
        content_match = False
        file_match = False

        # Extract session timestamp from filename
        ts_match = re.match(r"(\d{4}-\d{2}-\d{2}T[\d-]+Z)", os.path.basename(filepath))
        if ts_match:
            session_data["session_timestamp"] = ts_match.group(1)

        try:
            with open(filepath, "r", encoding="utf-8") as f:
                for line in f:
                    try:
                        d = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    # Session header
                    if d.get("type") == "session":
                        cwd = d.get("cwd", "")
                        session_data["session_cwd"] = cwd
                        session_data["session_cwd_compact"] = compact_cwd(cwd)

                    # Session info (name changes)
                    if d.get("type") == "session_info":
                        name = d.get("name", "")
                        session_data["session_name"] = name
                        if name:
                            name_history.append(name)

                    msg = d.get("message", {})

                    # User messages
                    if msg.get("role") == "user":
                        for c in msg.get("content", []):
                            if isinstance(c, dict) and c.get("type") == "text":
                                text = c.get("text", "")
                                if text:
                                    user_texts_raw.append(text)
                                    # Check content match
                                    if mode in ("content", "all"):
                                        if query_lower in text.lower():
                                            content_match = True

                    # Tool calls (write/edit) from assistant
                    if msg.get("role") == "assistant":
                        for c in msg.get("content", []):
                            if isinstance(c, dict) and c.get("type") == "toolCall":
                                tool_name = c.get("name", "")
                                if tool_name in ("write", "edit"):
                                    args = c.get("arguments", {})
                                    path = args.get("path", "")
                                    if path:
                                        files_written.append(path)
                                        # Check file match
                                        if mode in ("file-written", "all"):
                                            if query_lower in path.lower():
                                                file_match = True

        except (OSError, UnicodeDecodeError):
            continue

        # Name match (including name history)
        if mode in ("name", "all"):
            if query_lower in session_data["session_name"].lower():
                name_match = True
            else:
                for old_name in name_history:
                    if query_lower in old_name.lower():
                        name_match = True
                        break

        # Determine if this session is a match
        match_reasons = []
        if name_match:
            match_reasons.append("name")
        if content_match:
            match_reasons.append("content")
        if file_match:
            match_reasons.append("file-written")

        if not match_reasons:
            continue

        session_data["match_reasons"] = match_reasons

        # Compute summary
        session_data["session_summary"] = compute_summary(
            session_data["session_name"], user_texts_raw
        )

        # Add name history if there were renames
        if len(name_history) > 1:
            session_data["name_history"] = name_history

        # Optionally include user texts
        if include_user_texts:
            session_data["user_texts"] = user_texts_raw[:5]
        else:
            # Always include at least first user text for context
            session_data["user_texts"] = [user_texts_raw[0][:200]] if user_texts_raw else []

        # Optionally include tool paths
        if include_tool_paths:
            session_data["files_written"] = files_written
        else:
            # Show only files matching the query
            matching_files = [
                p for p in files_written
                if query_lower in p.lower()
            ]
            session_data["files_written"] = matching_files[:5]

        results.append(session_data)

    # Sort: name match first, then file-written, then content
    def rank(r):
        order = {"name": 0, "file-written": 1, "content": 2}
        return min(order.get(m, 9) for m in r["match_reasons"])

    results.sort(key=rank)

    return {
        "query": query,
        "mode": mode,
        "total_matches": len(results),
        "results": results[:limit],
    }


def main():
    parser = argparse.ArgumentParser(description="Search pi coding agent sessions")
    parser.add_argument("--sessions", required=True, help="Path to sessions directory")
    parser.add_argument("--query", required=True, help="Search query")
    parser.add_argument("--mode", default="all",
                        choices=["content", "file-written", "name", "all"],
                        help="Search mode (default: all)")
    parser.add_argument("--limit", type=int, default=10, help="Max results (default: 10)")
    parser.add_argument("--include-user-texts", action="store_true",
                        help="Include first user messages in output")
    parser.add_argument("--include-tool-paths", action="store_true",
                        help="Include file paths from write/edit calls")

    args = parser.parse_args()

    result = search_sessions(
        sessions_dir=args.sessions,
        query=args.query,
        mode=args.mode,
        limit=args.limit,
        include_user_texts=args.include_user_texts,
        include_tool_paths=args.include_tool_paths,
    )

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
