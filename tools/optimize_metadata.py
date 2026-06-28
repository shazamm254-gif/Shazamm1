#!/usr/bin/env python3
"""
optimize_metadata.py — score and improve a Short's title, description, and tags
against YouTube Shorts best practices, tuned for the Project 3000 niche.

Runs fully offline with a rule-based linter (no API key needed). Add --use-claude
to also get an AI-rewritten title/description using your channel's voice.

Usage:
    # Lint a title (rule-based, instant, free):
    python tools/optimize_metadata.py --title "Future human evolution simulation"

    # Lint a full set from a JSON file:
    python tools/optimize_metadata.py --file my_upload.json

    # Also get 5 AI-rewritten titles + a description (needs ANTHROPIC_API_KEY):
    python tools/optimize_metadata.py --title "..." --use-claude

JSON file shape (all optional):
    { "title": "...", "description": "...", "tags": ["...", "..."] }
"""

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

POWER_WORDS = {
    "you", "your", "this", "why", "how", "what", "never", "always", "secret",
    "terrifying", "impossible", "shouldn't", "won't", "will", "future", "last",
    "first", "watch", "stop", "real", "truth", "actually", "finally",
}
# Curiosity-gap openers that work well for speculative content.
HOOK_STARTERS = ("what if", "this is", "in the year", "imagine", "scientists",
                 "nobody", "you won't", "evolution", "the last", "if ")


def load_niche():
    with open(os.path.join(HERE, "niche.json"), encoding="utf-8") as f:
        return json.load(f)


def lint_title(title, niche):
    issues, wins = [], []
    t = title.strip()
    n = len(t)

    if n == 0:
        return ["Title is empty."], []
    # Shorts titles get truncated on mobile around 40-50 chars in the feed.
    if n > 70:
        issues.append(f"Title is {n} chars — front-load the hook; the feed cuts "
                      f"off around 40-50.")
    elif n < 15:
        issues.append(f"Title is only {n} chars — add a curiosity gap or stakes.")
    else:
        wins.append(f"Length {n} chars is in a good range.")

    low = t.lower()
    if any(low.startswith(h) for h in HOOK_STARTERS):
        wins.append("Opens with a strong hook phrase.")
    else:
        issues.append("Doesn't open with a hook. Try 'What if…', 'In the year "
                      "3000…', 'This is…', 'The last…'.")

    if any(w in low for w in POWER_WORDS):
        wins.append("Contains curiosity/power words.")
    else:
        issues.append("No power words. Add tension: 'terrifying', 'won't', "
                      "'last', 'impossible', 'you'.")

    if not any(k in low for k in (kw.lower() for kw in niche["title_keywords"])):
        issues.append("No niche keyword found. Work in one of: "
                      + ", ".join(niche["title_keywords"][:6]) + ".")
    else:
        wins.append("Includes a niche keyword (good for search + relevance).")

    if "#" in t:
        issues.append("Put hashtags in the description, not the title — they eat "
                      "your visible character budget.")
    if t.isupper():
        issues.append("ALL CAPS reads as spammy; use sentence case for impact.")
    return issues, wins


def lint_description(desc, niche):
    issues, wins = [], []
    d = (desc or "").strip()
    if not d:
        issues.append("Empty description. Add 2-3 lines + hashtags; the first "
                      "line shows in search and feeds context to the algorithm.")
        return issues, wins
    if len(d) < 40:
        issues.append("Description is very short — add a sentence of context and "
                      "a call to subscribe.")
    else:
        wins.append("Description has real context.")

    has_core = sum(1 for h in niche["core_hashtags"] if h.lower() in d.lower())
    if has_core < 2:
        issues.append("Add your core hashtags: " + " ".join(niche["core_hashtags"]))
    else:
        wins.append("Uses your core hashtags.")
    if "#shorts" not in d.lower():
        issues.append("Add #shorts so YouTube reliably classifies it as a Short.")
    if "subscribe" not in d.lower():
        issues.append("No call to action. Add a short 'Subscribe to access the "
                      "archive.'-style line.")
    return issues, wins


def lint_tags(tags, niche):
    issues, wins = [], []
    tags = tags or []
    if len(tags) < 5:
        issues.append(f"Only {len(tags)} tags. Aim for 10-15 mixing broad "
                      "(#scifi) and specific (#speculativezoology).")
    else:
        wins.append(f"{len(tags)} tags — good coverage.")
    suggested = [h.lstrip("#") for h in niche["core_hashtags"] + niche["extra_hashtags"]]
    have = {t.lower().lstrip("#") for t in tags}
    missing = [s for s in suggested if s.lower() not in have][:6]
    if missing:
        issues.append("Consider adding tags: " + ", ".join(missing))
    return issues, wins


def report(label, issues, wins):
    print(f"\n  {label}")
    print("  " + "-" * 56)
    for w in wins:
        print(f"   ✓ {w}")
    for i in issues:
        print(f"   ✗ {i}")
    if not issues:
        print("   (no problems found)")


def claude_rewrite(title, desc, niche):
    try:
        import anthropic
    except ImportError:
        print("\n  --use-claude needs the anthropic package:  pip install anthropic")
        return
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("\n  --use-claude needs ANTHROPIC_API_KEY (see .env.example).")
        return

    client = anthropic.Anthropic()
    prompt = (
        f"You are a YouTube Shorts strategist for '{niche['channel_name']}', a "
        f"channel about: {niche['one_line']}\n"
        f"Tone: {niche['tone']}\n\n"
        f"Current title: {title!r}\n"
        f"Current description: {desc!r}\n\n"
        "Produce:\n"
        "1) Five rewritten title options (each under 60 chars, strong curiosity "
        "gap, no hashtags in the title).\n"
        "2) One improved 2-3 line description ending with a subscribe CTA and "
        f"these hashtags: {' '.join(niche['core_hashtags'] + ['#shorts'])}\n"
        "Keep it punchy and documentary-ominous. Return plain text."
    )
    print("\n  Asking Claude for rewrites...\n")
    msg = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=1500,
        thinking={"type": "adaptive"},
        messages=[{"role": "user", "content": prompt}],
    )
    for block in msg.content:
        if block.type == "text":
            print("  " + block.text.replace("\n", "\n  "))


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--title", default="")
    ap.add_argument("--description", default="")
    ap.add_argument("--tags", nargs="*", default=None)
    ap.add_argument("--file", help="JSON file with title/description/tags")
    ap.add_argument("--use-claude", action="store_true",
                    help="Also get AI-rewritten title/description")
    args = ap.parse_args()

    niche = load_niche()
    title, desc, tags = args.title, args.description, args.tags
    if args.file:
        with open(args.file, encoding="utf-8") as f:
            data = json.load(f)
        title = title or data.get("title", "")
        desc = desc or data.get("description", "")
        tags = tags if tags is not None else data.get("tags")

    if not (title or desc or tags):
        sys.exit("Give me something to check: --title, --description, --tags, or --file.")

    print(f"\n  Metadata check for {niche['channel_name']}")
    if title:
        report("TITLE", *lint_title(title, niche))
    if desc or args.file:
        report("DESCRIPTION", *lint_description(desc, niche))
    if tags is not None:
        report("TAGS", *lint_tags(tags, niche))

    if args.use_claude:
        claude_rewrite(title, desc, niche)
    print()


if __name__ == "__main__":
    main()
