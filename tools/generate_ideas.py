#!/usr/bin/env python3
"""
generate_ideas.py — generate Short video ideas (hook + concept) for your channel.

Reads everything from tools/niche.json, so it works for ANY niche — change that
one file and the ideas change with it.

Works two ways:
  * Default: instant, free, offline — fills your channel's hook templates with
    niche vocabulary from niche.json (no API key needed).
  * --use-claude: richer, original ideas with hook, concept, and a title, written
    in your channel's voice (needs ANTHROPIC_API_KEY).

Usage:
    python tools/generate_ideas.py -n 10
    python tools/generate_ideas.py -n 8 --use-claude
    python tools/generate_ideas.py -n 8 --use-claude --theme "rogue planets"
"""

import argparse
import json
import os
import random
import re

HERE = os.path.dirname(os.path.abspath(__file__))


def load_niche():
    with open(os.path.join(HERE, "niche.json"), encoding="utf-8") as f:
        return json.load(f)


def offline_ideas(n, niche):
    """Fill each hook template's {placeholders} from niche['fillers']."""
    templates = niche.get("hook_templates", [])
    fillers = niche.get("fillers", {})
    if not templates or not fillers:
        return ["(Add hook_templates and fillers to niche.json to generate offline ideas.)"]

    out, seen, attempts = [], set(), 0
    while len(out) < n and attempts < n * 30:
        attempts += 1
        hook = random.choice(templates)
        # Replace every {key} that we have a filler list for.
        for key in re.findall(r"\{(\w+)\}", hook):
            if key in fillers and fillers[key]:
                hook = hook.replace("{" + key + "}", random.choice(fillers[key]), 1)
        if "{" in hook:  # a placeholder with no filler — skip this draw
            continue
        hook = hook[0].upper() + hook[1:]
        if hook in seen:
            continue
        seen.add(hook)
        out.append(hook)
    return out


def claude_ideas(n, niche, theme):
    try:
        import anthropic
    except ImportError:
        print("--use-claude needs the anthropic package:  pip install anthropic")
        return None
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("--use-claude needs ANTHROPIC_API_KEY (see .env.example).")
        return None

    client = anthropic.Anthropic()
    theme_line = f"\nFocus this batch on the theme: {theme}\n" if theme else ""
    prompt = (
        f"You are the creative lead for the YouTube Shorts channel "
        f"'{niche['channel_name']}'.\n"
        f"Premise: {niche['one_line']}\n"
        f"Content pillars: {', '.join(niche['pillars'])}\n"
        f"Tone: {niche['tone']}\n"
        f"{theme_line}\n"
        f"Generate {n} original Short ideas. For EACH, give exactly:\n"
        "  HOOK: a scroll-stopping first line (said in the first 2 seconds)\n"
        "  CONCEPT: one sentence describing the visual/story arc of the Short\n"
        "  TITLE: a <60-char title with a curiosity gap, no hashtags\n\n"
        "Keep each idea distinct, accurate, and genuinely unsettling/awe-inducing. "
        "Number them. Return plain text."
    )
    msg = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=4000,
        thinking={"type": "adaptive"},
        messages=[{"role": "user", "content": prompt}],
    )
    return "".join(b.text for b in msg.content if b.type == "text")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-n", "--count", type=int, default=10)
    ap.add_argument("--use-claude", action="store_true")
    ap.add_argument("--theme", default="", help="Optional theme for the batch (Claude only)")
    args = ap.parse_args()

    niche = load_niche()
    print(f"\n  {args.count} Short ideas for {niche['channel_name']}")
    print("  " + "=" * 56)

    if args.use_claude:
        text = claude_ideas(args.count, niche, args.theme)
        if text:
            print("\n  " + text.replace("\n", "\n  ") + "\n")
            return
        print("  (falling back to offline templates)\n")

    for i, hook in enumerate(offline_ideas(args.count, niche), 1):
        print(f"  {i:>2}. {hook}")
    print("\n  Tip: run with --use-claude for full hook + concept + title ideas.\n")


if __name__ == "__main__":
    main()
