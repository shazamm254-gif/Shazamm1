#!/usr/bin/env python3
"""
viral_generator.py — the end-to-end viral niche + script generator.

One command does the whole pipeline:

  1. NICHE  — generates and scores niche candidates using the proven
     category/angle library from niche_generator.py (hook strength, demand,
     competition headroom, repeatability, feasibility — 0-100).
  2. PICK   — selects the top-ranked niche (or the one you ask for).
  3. SCRIPT — writes complete, ready-to-produce viral Short scripts for that
     niche: hook (0-2s), timed voiceover beats, on-screen text, shot-by-shot
     visuals, a loop/comment-bait ending, and paste-ready title + description.

Offline scripts follow a proven viral structure (hook -> setup -> escalation ->
payoff -> loop) with [FACT: ...] research slots to fill with real, sourced
details — every script ships with its own research checklist. Add --use-claude
and the model writes the voiceover in full (needs ANTHROPIC_API_KEY).

Usage:
    python tools/viral_generator.py                          # scan 8 niches, script the winner
    python tools/viral_generator.py -n 12 --scripts 8        # wider scan, more scripts
    python tools/viral_generator.py --parent "true crime"    # focus the niche search
    python tools/viral_generator.py --pick 3                 # script the 3rd-ranked niche
    python tools/viral_generator.py --niche-file niche-money.json   # script an existing niche
    python tools/viral_generator.py --use-claude             # AI-written voiceovers
    python tools/viral_generator.py --export-md docs/PACK.md # save a production pack
    python tools/viral_generator.py --export-niche tools/niche_new.json

Niche discovery is always offline (transparent, reproducible scoring); for
AI-invented niches run niche_generator.py --use-claude and feed its --export
output back in here with --niche-file.
"""

import argparse
import json
import os
import random
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import niche_generator as ng  # noqa: E402  (PARENTS/ANGLES library + scoring)

# ---------------------------------------------------------------------------
# Script blueprints — one per angle. Each script is assembled from a proven
# viral Shorts structure:  HOOK (0-2s) -> SETUP (2-7s) -> ESCALATION (7-18s)
# -> PAYOFF (18-25s) -> LOOP (25-30s).  {x} is the topic phrase; bracketed
# [FACT: ...] markers are research slots — real, sourced details you (or
# --use-claude) fill in before recording.
# ---------------------------------------------------------------------------
BLUEPRINTS = {
    "what_if": {
        "setup": "It sounds impossible — but the mechanics are real. Here's what would actually happen.",
        "escalate": "First: [FACT: the immediate consequence, with a real number]. Within [TIME: a realistic timeframe], [FACT: the second-order consequence].",
        "payoff": "The end state? [PAYOFF: the final consequence, stated plainly].",
        "loop": "Now ask yourself — what if it already started?",
    },
    "forbidden": {
        "setup": "For years, the full story of {x} stayed out of public view. [FACT: who suppressed or classified it, and when].",
        "escalate": "The documents show [FACT: the key revealed detail]. And buried deeper: [FACT: the detail that changes the story].",
        "payoff": "[PAYOFF: why it was hidden — the motive, in one sentence].",
        "loop": "Makes you wonder what else is still sealed.",
    },
    "debunk": {
        "setup": "You've heard the myth: [MYTH: the common belief, in one sentence]. Almost everyone believes it.",
        "escalate": "But the evidence says otherwise. [FACT: the strongest evidence against the myth]. [FACT: where the myth actually came from].",
        "payoff": "The truth: [PAYOFF: the corrected fact, one clean sentence].",
        "loop": "Tell me you didn't believe it. I did.",
    },
    "countdown": {
        "setup": "Number three: [ITEM: the third-ranked example, plus one vivid detail].",
        "escalate": "Number two: [ITEM: the second-ranked example, plus the number that makes it insane].",
        "payoff": "And number one — [ITEM: the top example]. [PAYOFF: the detail that beats everything above].",
        "loop": "Which one would you least want to face? Comments.",
    },
    "hidden_history_angle": {
        "setup": "The textbook version stops early. [FACT: the commonly taught version, in one line].",
        "escalate": "What got left out: [FACT: the missing event or figure]. And the records show [FACT: the detail that rewrites the timeline].",
        "payoff": "[PAYOFF: what the full story actually means].",
        "loop": "History didn't forget this part. It was left out.",
    },
    "pov_sim": {
        "setup": "First, [FACT: the first thing you'd physically experience]. You don't get time to think.",
        "escalate": "Then it escalates: [FACT: the second stage — sensory and specific]. Your odds right now: [STAT: real survival odds or time window].",
        "payoff": "[PAYOFF: how it ends — the survival window, or the point of no return].",
        "loop": "Would you make it? Be honest.",
    },
    "worst_case": {
        "setup": "The normal version is bad. This is the version experts lose sleep over. [FACT: the baseline case, in one line].",
        "escalate": "Now scale it up: [FACT: the recorded worst case, with the number]. And if [CONDITION: the one factor that makes it worse] — it compounds.",
        "payoff": "[PAYOFF: the full worst-case end state, stated calmly].",
        "loop": "The unsettling part? Nothing here is impossible.",
    },
    "deep_dive": {
        "setup": "Here's the part everyone skips: [FACT: the core mechanism, in one plain sentence].",
        "escalate": "That matters because [FACT: the first consequence]. It also explains [FACT: the connected thing people get wrong].",
        "payoff": "So in one line: [PAYOFF: the whole idea, compressed].",
        "loop": "Sixty seconds. Now you know it better than most.",
    },
    "compare_extremes": {
        "setup": "On one end: [ITEM: the smallest or mildest case, with the number]. Seems manageable.",
        "escalate": "On the other: [ITEM: the biggest or most extreme case, with the number]. That's a gap of [STAT: the ratio or difference].",
        "payoff": "[PAYOFF: why the gap exists — one sentence].",
        "loop": "Your brain can't actually picture that. Nobody's can.",
    },
    "investigation": {
        "setup": "Here's what's on the record: [FACT: the established facts, one line].",
        "escalate": "But then the evidence turns: [FACT: the anomaly]. Investigators also found [FACT: the detail that doesn't fit].",
        "payoff": "[PAYOFF: the leading explanation — and the one thing it fails to explain].",
        "loop": "Case closed? You decide. Comments.",
    },
    "time_capsule": {
        "setup": "Today, [FACT: the current state, in one line]. That's already changing.",
        "escalate": "By [YEAR: a near milestone], [FACT: the projected change, with the source]. A century out: [FACT: the far projection].",
        "payoff": "[PAYOFF: the end state in 100 years, one sentence].",
        "loop": "Someone watching this will live to see it.",
    },
    "expert_reveal": {
        "setup": "Ask someone who works with {x} every day, and they'll tell you: [FACT: the insider's first surprising point].",
        "escalate": "Behind the scenes: [FACT: what the process actually looks like]. And the part they rarely say out loud: [FACT: the uncomfortable detail].",
        "payoff": "[PAYOFF: the insider's bottom line].",
        "loop": "Now you know what the professionals know.",
    },
    "_generic": {
        "setup": "{X} sounds like fiction. It isn't. [FACT: one concrete, sourced detail that proves it's real].",
        "escalate": "And it gets stranger. [FACT: the most extreme number or case on record]. Then [FACT: the detail almost nobody knows].",
        "payoff": "Here's the part that stays with you: [PAYOFF: the twist or resolution — one sentence].",
        "loop": "And that's only the beginning of the story.",
    },
}

BEAT_TIMINGS = [("HOOK", "0-2s"), ("SETUP", "2-7s"), ("ESCALATION", "7-18s"),
                ("PAYOFF", "18-25s"), ("LOOP", "25-30s")]

VISUAL_SHOTS = [
    "Cold open on {x} — tight framing, high contrast, motion in the first frame",
    "Pull back to reveal scale/context of {x}; on-screen text lands with the hook",
    "Rapid cuts (every 1.5-3s) illustrating each escalation fact — one image per fact",
    "Final shot: the payoff image, slow push-in, cut to black on the loop line",
]

RESEARCH_RE = re.compile(r"\[([A-Z]+): ([^\]]+)\]")


def strip_article(phrase):
    return re.sub(r"^(a|an|the)\s+", "", phrase, flags=re.IGNORECASE)


def fill(template, topic):
    text = template.replace("{x}", topic).replace("{X}", topic[0].upper() + topic[1:])
    return text[0].upper() + text[1:]


def make_title(hook, topic):
    title = hook.strip().strip('"').rstrip(".!").replace("Here's", "Here's")
    if len(title) > 60:
        # fall back to a compact curiosity-gap title built from the topic
        title = f"The truth about {strip_article(topic)} nobody tells you"
    return title[:60]


def hook_for(rng, hook_templates, fillers, primary_key):
    """Draw a hook; return (hook_text, topic_used).

    Templates may carry {x} (generator angles) or arbitrary {keys} (channel
    niche.json files) — every placeholder gets filled; the first fill becomes
    the script's topic.
    """
    for _ in range(30):
        template = rng.choice(hook_templates)
        keys = re.findall(r"\{(\w+)\}", template)
        if not keys:
            continue
        topic = None
        text = template
        for key in keys:
            pool = fillers.get(key) or fillers.get(primary_key)
            if not pool:
                break
            value = rng.choice(pool)
            text = text.replace("{" + key + "}", value, 1)
            topic = topic or value
        if "{" not in text and topic:
            return text[0].upper() + text[1:], topic
    topic = rng.choice(fillers[primary_key])
    return f"The truth about {strip_article(topic)} isn't what you think.", topic


def build_script(rng, n, topic, hook, blueprint, pillar, hashtags, channel_hint):
    topic_clean = strip_article(topic)
    beats = [("HOOK", "0-2s", hook)]
    for beat_key, (label, timing) in zip(("setup", "escalate", "payoff", "loop"),
                                          BEAT_TIMINGS[1:]):
        beats.append((label, timing, fill(blueprint[beat_key], topic)))

    vo = " ".join(text for _, _, text in beats)
    research = [f"{kind}: {desc}" for kind, desc in RESEARCH_RE.findall(vo)]
    tags = (hashtags[:5] if hashtags else []) + ["#shorts"]
    return {
        "number": n,
        "series": pillar,
        "topic": topic,
        "hook": hook,
        "on_screen": topic_clean.upper()[:28],
        "beats": [{"beat": label, "time": timing, "text": text} for label, timing, text in beats],
        "visuals": [shot.replace("{x}", topic) for shot in VISUAL_SHOTS],
        "end_line": beats[-1][2],
        "title": make_title(hook, topic),
        "description": (f"{topic_clean[0].upper() + topic_clean[1:]}, in 30 seconds. "
                         f"Follow for more {channel_hint}. " + " ".join(tags)),
        "hashtags": tags,
        "research": research,
    }


def scripts_for_generated(rng, niche, count):
    """Scripts for a niche minted by the generator (has _parent/_angle)."""
    parent, angle = niche["_parent"], niche["_angle"]
    blueprint = BLUEPRINTS.get(angle["key"], BLUEPRINTS["_generic"])
    topics = parent["vocab"][:]
    rng.shuffle(topics)
    pillars = parent["pillars"]
    out = []
    for i in range(count):
        topic = topics[i % len(topics)]
        hook, _ = hook_for(rng, angle["hook_templates"], {"x": [topic]}, "x")
        out.append(build_script(rng, i + 1, topic, hook, blueprint,
                                 pillars[i % len(pillars)], parent["hashtags"],
                                 niche["name"]))
    return out


def scripts_for_niche_file(rng, niche_doc, count):
    """Scripts for an existing channel niche config (tools/niche*.json)."""
    fillers = niche_doc.get("fillers", {})
    if not fillers:
        sys.exit("This niche file has no 'fillers' — add some topic lists to script it.")
    primary_key = "x" if "x" in fillers else max(fillers, key=lambda k: len(fillers[k]))
    hook_templates = niche_doc.get("hook_templates") or []
    if not hook_templates:
        sys.exit("This niche file has no 'hook_templates'.")
    pillars = niche_doc.get("pillars") or ["General"]
    hashtags = niche_doc.get("core_hashtags", [])
    out, seen = [], set()
    while len(out) < count and len(seen) < count * 30:
        hook, topic = hook_for(rng, hook_templates, fillers, primary_key)
        if hook in seen:
            continue
        seen.add(hook)
        out.append(build_script(rng, len(out) + 1, topic, hook, BLUEPRINTS["_generic"],
                                 pillars[len(out) % len(pillars)], hashtags,
                                 niche_doc.get("channel_name", "this channel")))
    return out


# ---------------------------------------------------------------------------
# Claude mode — the model writes full voiceovers (no research slots left over)
# ---------------------------------------------------------------------------
CLAUDE_SCRIPT_SCHEMA = """Return ONLY a JSON array (no prose, no markdown fences). Each element:
{
  "series": "which content pillar this belongs to",
  "topic": "the specific topic phrase",
  "hook": "scroll-stopping first line, said + shown in the first 2 seconds",
  "on_screen": "big on-screen text, <=28 chars, uppercase",
  "vo": "the full voiceover, 55-80 words, timed for a 25-30s Short — factually grounded, no invented numbers",
  "visuals": ["4 shot descriptions, cut every 1.5-3s"],
  "end_line": "the final line — loops back to the hook or provokes a comment",
  "title": "<60-char title with a curiosity gap, no hashtags",
  "description": "1-2 sentence description ending with 5-6 hashtags incl. #shorts"
}"""


def claude_scripts(niche_name, one_liner, pillars, tone, hooks_hint, count, theme):
    try:
        import anthropic
    except ImportError:
        print("--use-claude needs the anthropic package:  pip install anthropic")
        return None
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("--use-claude needs ANTHROPIC_API_KEY (see .env.example).")
        return None

    client = anthropic.Anthropic()
    theme_line = f"\nLean this batch toward the theme: {theme}\n" if theme else ""
    prompt = (
        f"You are the head writer for a faceless viral Shorts channel.\n"
        f"Niche: {niche_name}\nPremise: {one_liner}\n"
        f"Content pillars: {', '.join(pillars)}\nVoice/format: {tone}\n"
        f"Example hooks in this niche: {hooks_hint}\n{theme_line}\n"
        f"Write {count} complete, ready-to-record Short scripts, spread across the "
        f"pillars. Structure each voiceover as hook -> setup -> escalation -> payoff "
        f"-> loop, front-load the curiosity gap, and end on a line that drives "
        f"re-watches or comments. Every fact must be real — dramatize, don't "
        f"fabricate.\n\n{CLAUDE_SCRIPT_SCHEMA}"
    )
    msg = client.messages.create(
        model="claude-opus-5",
        max_tokens=8000,
        thinking={"type": "adaptive"},
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in msg.content if b.type == "text")
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if not match:
        print("Claude didn't return parseable JSON. Raw output:\n" + text)
        return None
    try:
        raw = json.loads(match.group(0))
    except json.JSONDecodeError as e:
        print(f"Couldn't parse Claude's JSON ({e}). Raw output:\n" + text)
        return None

    out = []
    for i, r in enumerate(raw, 1):
        out.append({
            "number": i,
            "series": r.get("series", ""),
            "topic": r.get("topic", ""),
            "hook": r.get("hook", ""),
            "on_screen": r.get("on_screen", "")[:28],
            "beats": [{"beat": "VO", "time": "0-30s", "text": r.get("vo", "")}],
            "visuals": r.get("visuals", []),
            "end_line": r.get("end_line", ""),
            "title": r.get("title", "")[:60],
            "description": r.get("description", ""),
            "hashtags": re.findall(r"#\w+", r.get("description", "")),
            "research": [],
        })
    return out


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
def print_niche_summary(niche):
    print(f"\n  WINNING NICHE: {niche['name']}  —  {niche['score']}/100  ({niche['tier']})")
    print("  " + "=" * 64)
    print(f"   Category: {niche['parent']}   Angle: {niche['angle']}")
    print(f"   {niche['one_liner']}")
    print("   Why it works:")
    for b in niche["why"]:
        print(f"     - {b}")


def print_scripts(scripts, label):
    print(f"\n  {len(scripts)} viral scripts — {label}")
    print("  " + "=" * 64)
    for s in scripts:
        print(f"\n  {s['number']}. \"{s['title']}\"  ·  {s['series']}")
        print("  " + "-" * 64)
        print(f"   ON-SCREEN: {s['on_screen']}")
        for beat in s["beats"]:
            print(f"   {beat['beat']} ({beat['time']}): {beat['text']}")
        print("   VISUALS:")
        for shot in s["visuals"]:
            print(f"     - {shot}")
        print(f"   TITLE: {s['title']}")
        print(f"   DESC:  {s['description']}")
        if s["research"]:
            print("   RESEARCH TO FILL:")
            for item in s["research"]:
                print(f"     [ ] {item}")
    print()


def export_markdown(path, niche_name, tagline, scripts):
    lines = [f"# {niche_name} — Viral Script Pack", ""]
    if tagline:
        lines += [tagline, ""]
    lines += ["Generated by `tools/viral_generator.py`. Each script: hook the first 2 "
              "seconds, cut visuals every 1.5-3s, end on the loop line. Fill every "
              "research slot with a real, sourced fact before recording.", "", "---", ""]
    for s in scripts:
        lines.append(f"## {s['number']} — \"{s['title']}\" · *{s['series']}*")
        lines.append("")
        lines.append(f"- **HOOK (0-2s):** *\"{s['hook']}\"*")
        lines.append(f"- **ON-SCREEN:** {s['on_screen']}")
        vo = " ".join(b["text"] for b in s["beats"])
        lines.append(f"- **VO:** \"{vo}\"")
        lines.append("- **VISUALS:** " + " → ".join(s["visuals"]))
        lines.append(f"- **END:** *\"{s['end_line']}\"*")
        lines.append(f"- **TITLE:** {s['title']}")
        lines.append(f"- **DESC:** {s['description']}")
        if s["research"]:
            lines.append("- **RESEARCH TO FILL:**")
            for item in s["research"]:
                lines.append(f"  - [ ] {item}")
        lines += ["", "---", ""]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"  Saved production pack -> {path}")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-n", "--count", type=int, default=8,
                    help="How many niche candidates to generate and rank (default 8)")
    ap.add_argument("--scripts", type=int, default=5,
                    help="How many scripts to write for the chosen niche (default 5)")
    ap.add_argument("--parent", default="", help="Focus the niche search on one "
                    "category (substring match, e.g. 'true crime')")
    ap.add_argument("--pick", type=int, default=1,
                    help="Script the Nth-ranked niche instead of the winner")
    ap.add_argument("--niche-file", default="", help="Skip niche generation and write "
                    "scripts for an existing niche config (e.g. niche-money.json)")
    ap.add_argument("--use-claude", action="store_true",
                    help="AI-written full voiceovers (needs ANTHROPIC_API_KEY)")
    ap.add_argument("--theme", default="", help="Optional theme for the batch (Claude only)")
    ap.add_argument("--seed", type=int, default=None, help="Random seed for reproducible runs")
    ap.add_argument("--json", action="store_true", help="Print raw JSON instead of the report")
    ap.add_argument("--export-md", metavar="PATH", default="",
                    help="Also save the scripts as a markdown production pack")
    ap.add_argument("--export-niche", metavar="PATH", default="",
                    help="Also export the chosen niche as a niche.json-compatible file")
    args = ap.parse_args()

    rng = random.Random(args.seed)
    niche = None
    niche_doc = None

    if args.niche_file:
        path = args.niche_file if os.path.isabs(args.niche_file) \
            else os.path.join(HERE, args.niche_file)
        with open(path, encoding="utf-8") as f:
            niche_doc = json.load(f)
        name = niche_doc.get("channel_name", os.path.basename(path))
        tagline = niche_doc.get("one_line", "")
    else:
        results = ng.generate_offline(max(args.count, args.pick), args.parent, rng)
        if not (1 <= args.pick <= len(results)):
            sys.exit(f"--pick {args.pick} is out of range (generated {len(results)} niches).")
        niche = results[args.pick - 1]
        name = niche["name"]
        tagline = niche["one_liner"]
        if not args.json:
            print_niche_summary(niche)

    if args.use_claude:
        if niche is not None:
            pillars = niche["_parent"]["pillars"]
            tone = f"{niche['angle']} — {niche['_angle']['description']}"
            hooks_hint = niche["hook_example"]
        else:
            pillars = niche_doc.get("pillars", [])
            tone = niche_doc.get("tone", "")
            hooks_hint = "; ".join(niche_doc.get("hook_templates", [])[:3])
        scripts = claude_scripts(name, tagline, pillars, tone, hooks_hint,
                                 args.scripts, args.theme)
        if scripts is None:
            print("  (falling back to offline scripts)")
            scripts = None
        label = "Claude-written"
    else:
        scripts = None
        label = "offline (fill the research slots before recording)"

    if scripts is None:
        if niche is not None:
            scripts = scripts_for_generated(rng, niche, args.scripts)
        else:
            scripts = scripts_for_niche_file(rng, niche_doc, args.scripts)

    if args.json:
        payload = {"niche": {k: v for k, v in (niche or {}).items()
                              if not k.startswith("_")} if niche else name,
                   "scripts": scripts}
        print(json.dumps(payload, indent=2))
    else:
        print_scripts(scripts, label)

    if args.export_md:
        export_markdown(args.export_md, name, tagline, scripts)
    if args.export_niche:
        if niche is None:
            sys.exit("--export-niche only applies when the niche was generated "
                     "(not with --niche-file).")
        ng.export_niche(niche, args.export_niche)


if __name__ == "__main__":
    main()
