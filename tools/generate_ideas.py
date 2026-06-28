#!/usr/bin/env python3
"""
generate_ideas.py — generate Short video ideas (hook + concept) for Project 3000.

Works two ways:
  * Default: instant, free, offline — fills your channel's proven hook templates
    with niche subjects (no API key needed).
  * --use-claude: richer, original ideas with hook, concept, and a title, written
    in your channel's voice (needs ANTHROPIC_API_KEY).

Usage:
    python tools/generate_ideas.py -n 10
    python tools/generate_ideas.py -n 8 --use-claude
    python tools/generate_ideas.py -n 8 --use-claude --theme "Mars colonists"
"""

import argparse
import json
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))

# Fill-ins for the offline template generator. Tuned to the niche.
SUBJECTS = ["the human hand", "the human eye", "sharks", "octopuses", "ants",
            "house cats", "wolves", "crows", "jellyfish", "the human spine",
            "forests", "coral reefs", "deep-sea fish", "spiders", "whales"]
TIMEFRAMES = ["1,000 years", "10,000 years", "a million years", "10 million years",
              "100 million years", "five generations", "a single ice age"]
EVENTS = ["a second ice age", "an ocean boil-off", "a gamma-ray burst",
          "an oxygen collapse", "a total blackout", "a gravity surge",
          "the sun dimming", "the Earth stopping its spin"]
ENVIRONMENTS = ["a drowned Earth", "the Martian surface", "a frozen wasteland",
                "a radioactive desert", "total darkness", "a high-gravity world"]
ANIMALS = ["dogs", "humans", "pigeons", "rats", "cockroaches", "deer", "bees"]


def load_niche():
    with open(os.path.join(HERE, "niche.json"), encoding="utf-8") as f:
        return json.load(f)


def offline_ideas(n, niche):
    out, seen = [], set()
    templates = niche["hook_templates"]
    attempts = 0
    while len(out) < n and attempts < n * 20:
        attempts += 1
        hook = random.choice(templates)
        hook = (hook.replace("{subject}", random.choice(SUBJECTS))
                    .replace("{timeframe}", random.choice(TIMEFRAMES))
                    .replace("{event}", random.choice(EVENTS))
                    .replace("{environment}", random.choice(ENVIRONMENTS))
                    .replace("{animal}", random.choice(ANIMALS)))
        hook = hook[0].upper() + hook[1:] if hook else hook
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
        "Make each idea distinct and genuinely intriguing. Number them. "
        "Return plain text."
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
