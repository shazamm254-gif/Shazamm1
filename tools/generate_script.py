#!/usr/bin/env python3
"""
generate_script.py — turn a hook/idea into a full, timed, shot-by-shot Short
script (HOOK, ON-SCREEN, VO beats, VISUALS, END, TITLE, DESC), ready to feed
into generate_visuals.py (prompts) and assemble_video.py (final render).

Reads everything from a niche config (tools/niche.json by default), so it
works for any niche the same way the rest of the toolkit does.

Works two ways:
  * Default: instant, free, offline — assembles a rough draft from your
    niche's hook/end templates and fillers (no API key needed). Good for
    blocking out timing and shot count fast; expect to punch up the wording.
  * --use-claude: a fully written, on-voice script with real narration,
    matching the quality of docs/FIRST_10_SHORTS.md (needs ANTHROPIC_API_KEY).

Usage:
    python tools/generate_script.py --hook "This is what happens if you fall into a black hole."
    python tools/generate_script.py --use-claude --series "Space Horror"
    python tools/generate_script.py --use-claude --hook "..." --out tools/output/script_01.json
"""

import argparse
import json
import os
import random
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_WPS = 2.5  # narration pace fallback: words per second


def load_niche(niche_file="niche.json"):
    path = niche_file if os.path.isabs(niche_file) else os.path.join(HERE, niche_file)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def slugify(text, max_len=48):
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:max_len] or "script"


def fill_template(template, fillers):
    """Replace every {key} in template with a random pick from fillers[key]."""
    out = template
    for key in re.findall(r"\{(\w+)\}", template):
        choices = fillers.get(key)
        if choices:
            out = out.replace("{" + key + "}", random.choice(choices), 1)
    return out


def pick_hook(niche, hook=None, series=None):
    if hook:
        return hook
    templates = niche.get("hook_templates", [])
    if not templates:
        sys.exit("No --hook given and niche.json has no hook_templates to draw from.")
    return fill_template(random.choice(templates), niche.get("fillers", {}))


def on_screen_from_hook(hook):
    """Pull a short, punchy all-caps on-screen line out of the hook."""
    words = re.findall(r"[A-Za-z'-]+", hook)
    stop = {"a", "an", "the", "is", "this", "what", "if", "in", "of", "to", "it",
            "here's", "how", "when", "there's", "and", "you"}
    key_words = [w for w in words if w.lower() not in stop][:4]
    if not key_words:
        key_words = words[:4]
    return " ".join(key_words).upper()


def offline_script(niche, hook, series):
    """Build a rough 3-beat draft: HOOK -> BUILD -> PAYOFF. Free, instant,
    no AI — meant to block out timing/shots fast. Punch up the wording by
    hand or re-run with --use-claude for finished narration."""
    fillers = niche.get("fillers", {})
    pillars = niche.get("pillars", [])
    end_templates = niche.get("end_templates", ["And that's the part nobody talks about."])

    build_bits = []
    for key in ("object", "x", "event", "place"):
        if fillers.get(key):
            build_bits.append(random.choice(fillers[key]))
    build_line = (
        f"That comes down to {build_bits[0]}."
        if build_bits else
        f"That connects straight back to {random.choice(pillars) if pillars else 'the core idea'}."
    )

    end_line = random.choice(end_templates)

    beats = [
        {
            "on_screen": on_screen_from_hook(hook),
            "vo": hook,
            "visual": f"Establishing shot that visualizes: {hook}",
        },
        {
            "on_screen": "",
            "vo": build_line + " Here's what that actually means, and why it matters.",
            "visual": "A supporting shot that develops the idea from the hook — one clear subject, cut in close.",
        },
        {
            "on_screen": end_line.upper() if len(end_line) <= 24 else "",
            "vo": end_line,
            "visual": "A final shot that lands the payoff — pull back, let it breathe, hard cut to black.",
        },
    ]
    title = hook if len(hook) <= 60 else hook[:57].rsplit(" ", 1)[0] + "..."
    core = " ".join(niche.get("core_hashtags", []))
    desc = f"{end_line} Subscribe for more. {core} #shorts".strip()

    return {
        "channel_name": niche.get("channel_name", ""),
        "series": series or "",
        "hook": hook,
        "title": title,
        "description": desc,
        "end_line": end_line,
        "beats": beats,
        "generated_by": "offline-draft",
    }


CLAUDE_JSON_SCHEMA_HINT = """Return ONLY a single JSON object, no prose, no code fences, shaped exactly like:
{
  "hook": "the exact line said aloud in the first 2 seconds",
  "series": "which content pillar this belongs to",
  "title": "a <60-char paste-ready YouTube title, no hashtags",
  "description": "a 2-3 line paste-ready description ending with a subscribe CTA and hashtags",
  "end_line": "the loop/payoff line spoken last",
  "beats": [
    {"on_screen": "SHORT ALL-CAPS ON-SCREEN TEXT OR EMPTY STRING", "vo": "the voiceover sentence(s) for this beat", "visual": "one sentence describing exactly what should be shown, written as an image/video generation prompt subject"}
  ]
}
Use 3 to 6 beats. Total narration should read aloud in 15-30 seconds at roughly {wps} words/second. The first beat's "vo" should open with (or be) the hook."""


def claude_script(niche, hook, series):
    try:
        import anthropic
    except ImportError:
        print("--use-claude needs the anthropic package:  pip install anthropic")
        return None
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("--use-claude needs ANTHROPIC_API_KEY (see .env.example).")
        return None

    client = anthropic.Anthropic()
    wps = niche.get("narration_wps", DEFAULT_WPS)
    series_line = f"\nThis Short belongs to the series/pillar: {series}\n" if series else ""
    hook_line = f"\nUse this exact hook as the opening line: {hook!r}\n" if hook else (
        f"\nInvent an original hook in the style of these examples: "
        f"{niche.get('hook_templates', [])[:4]}\n"
    )
    prompt = (
        f"You are the creative lead and scriptwriter for the YouTube Shorts channel "
        f"'{niche['channel_name']}'.\n"
        f"Premise: {niche['one_line']}\n"
        f"Content pillars: {', '.join(niche.get('pillars', []))}\n"
        f"Audience: {niche.get('audience', '')}\n"
        f"Tone: {niche['tone']}\n"
        f"{series_line}{hook_line}\n"
        "Write one complete, ready-to-produce Short script — accurate, on-voice, "
        "and built to win the first 2 seconds and loop or provoke a comment at the end. "
        "Break the narration into short beats (one setup per visual cut, every 1.5-4s "
        "of narration).\n\n"
        + CLAUDE_JSON_SCHEMA_HINT.format(wps=wps)
    )
    msg = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=2000,
        thinking={"type": "adaptive"},
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in msg.content if b.type == "text").strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        print("Claude didn't return parseable JSON. Raw output:\n" + text)
        return None
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError as e:
        print(f"Couldn't parse Claude's JSON ({e}). Raw output:\n" + text)
        return None
    data.setdefault("channel_name", niche.get("channel_name", ""))
    data["generated_by"] = "claude"
    return data


def add_timing(script, niche):
    wps = niche.get("narration_wps", DEFAULT_WPS)
    total = 0.0
    for beat in script.get("beats", []):
        words = len(re.findall(r"\S+", beat.get("vo", "")))
        duration = max(1.2, round(words / wps, 2)) if words else 1.5
        beat["words"] = words
        beat["duration"] = duration
        total += duration
    script["total_duration"] = round(total, 2)
    return script


def print_script(script):
    print(f"\n  {script.get('channel_name', '')} — script"
          + (f"  ·  {script['series']}" if script.get("series") else ""))
    print("  " + "=" * 56)
    print(f"  TITLE: {script.get('title', '')}")
    print(f"  DESC:  {script.get('description', '')}")
    print(f"  TOTAL: ~{script.get('total_duration', '?')}s across {len(script.get('beats', []))} beats\n")
    for i, beat in enumerate(script.get("beats", []), 1):
        print(f"  [{i}] ({beat.get('duration', '?')}s, {beat.get('words', '?')}w)")
        if beat.get("on_screen"):
            print(f"      ON-SCREEN: {beat['on_screen']}")
        print(f"      VO:        {beat.get('vo', '')}")
        print(f"      VISUAL:    {beat.get('visual', '')}")
    print(f"\n  END: {script.get('end_line', '')}\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--hook", default="", help="Use this exact hook instead of generating one")
    ap.add_argument("--series", default="", help="Content pillar/series this Short belongs to")
    ap.add_argument("--use-claude", action="store_true", help="Write a full on-voice script with AI")
    ap.add_argument("--niche-file", default="niche.json",
                     help="Path to a niche config (default: tools/niche.json)")
    ap.add_argument("--out", default="", help="Write script JSON here "
                     "(default: tools/output/script_<slug>.json)")
    args = ap.parse_args()

    niche = load_niche(args.niche_file)

    script = None
    if args.use_claude:
        script = claude_script(niche, args.hook, args.series)
        if script is None:
            print("  (falling back to an offline draft)\n")
    if script is None:
        hook = args.hook or pick_hook(niche, None, args.series)
        script = offline_script(niche, hook, args.series)

    script = add_timing(script, niche)
    print_script(script)

    out_path = args.out or os.path.join(HERE, "output", f"script_{slugify(script.get('title') or script.get('hook', ''))}.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(script, f, indent=2, ensure_ascii=False)
    print(f"  Saved -> {out_path}")
    print(f"  Next: python tools/generate_visuals.py --script {out_path}\n")


if __name__ == "__main__":
    main()
