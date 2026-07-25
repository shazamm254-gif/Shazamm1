#!/usr/bin/env python3
"""
generate_visuals.py — turn a script (from generate_script.py) into paste-ready
AI image/video generation prompts, styled consistently with your niche's
visual identity (tools/niche.json -> "visual_style").

Works two ways:
  * Default: instant, free, offline — appends your niche's master style
    suffix + series tag to each beat's "visual" line (no API key needed).
  * --use-claude: 2-3 stronger, more specific prompt variations per beat,
    written to match your channel's visual brand (needs ANTHROPIC_API_KEY).

Usage:
    python tools/generate_visuals.py --script tools/output/script_foo.json
    python tools/generate_visuals.py --script tools/output/script_foo.json --use-claude
    python tools/generate_visuals.py --script tools/output/script_foo.json --tool midjourney
"""

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

ASPECT_FLAGS = {
    "midjourney": "--ar 9:16",
    "runway": "vertical 9:16 preset",
    "kling": "vertical 9:16 preset",
    "pika": "vertical 9:16 preset",
    "dalle": "1080x1920 (9:16)",
    "flux": "1080x1920 (9:16)",
    "generic": "9:16 vertical",
}


def load_niche(niche_file="niche.json"):
    path = niche_file if os.path.isabs(niche_file) else os.path.join(HERE, niche_file)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_script(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def build_prompt(visual_line, style, series_tag, tool):
    parts = [visual_line.strip().rstrip(".")]
    if style.get("style_suffix"):
        parts.append(style["style_suffix"])
    if series_tag:
        parts.append(series_tag)
    prompt = ", ".join(p for p in parts if p)
    flag = ASPECT_FLAGS.get(tool, ASPECT_FLAGS["generic"])
    if tool == "midjourney":
        prompt += f" {flag} --style raw"
    return prompt, flag


def offline_visuals(script, niche, tool):
    style = niche.get("visual_style", {})
    series_tags = style.get("series_tags", {})
    series_tag = series_tags.get(script.get("series", ""), "")
    out = []
    for i, beat in enumerate(script.get("beats", []), 1):
        visual = beat.get("visual", "")
        if not visual:
            continue
        prompt, flag = build_prompt(visual, style, series_tag, tool)
        out.append({"beat": i, "prompt": prompt, "aspect_ratio_flag": flag})
    return out


def claude_visuals(script, niche, tool):
    try:
        import anthropic
    except ImportError:
        print("--use-claude needs the anthropic package:  pip install anthropic")
        return None
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("--use-claude needs ANTHROPIC_API_KEY (see .env.example).")
        return None

    style = niche.get("visual_style", {})
    client = anthropic.Anthropic()
    beats_desc = "\n".join(
        f"{i}. {b.get('visual', '')}" for i, b in enumerate(script.get("beats", []), 1)
        if b.get("visual")
    )
    prompt = (
        f"You write AI image/video generation prompts for the YouTube Shorts channel "
        f"'{niche.get('channel_name', '')}'.\n"
        f"Visual identity: {style.get('medium', '')}\n"
        f"Master style suffix (always end with something equivalent to this): "
        f"{style.get('style_suffix', '')}\n"
        f"Negative prompt to keep in mind (avoid these in the scene description): "
        f"{style.get('negative_prompt', '')}\n"
        f"Palette/accent guidance: {json.dumps(style.get('accent_colors', {}))}\n"
        f"Target tool: {tool}\n\n"
        f"For EACH numbered shot below, write ONE strong, specific, self-contained "
        f"image/video generation prompt (one subject, one light source, vertical 9:16 "
        f"framing implied by composition). Keep the channel's visual brand consistent "
        f"across all shots. Return plain text, numbered to match the input, one prompt "
        f"per line, no commentary.\n\n{beats_desc}"
    )
    msg = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=2000,
        thinking={"type": "adaptive"},
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in msg.content if b.type == "text")
    return text


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--script", required=True, help="Path to a script JSON from generate_script.py")
    ap.add_argument("--niche-file", default="niche.json",
                     help="Path to a niche config (default: tools/niche.json)")
    ap.add_argument("--use-claude", action="store_true", help="Write stronger AI-tailored prompts")
    ap.add_argument("--tool", default="generic",
                     choices=list(ASPECT_FLAGS.keys()),
                     help="Target generator, for the right aspect-ratio flag")
    ap.add_argument("--out", default="", help="Write prompts here (default: alongside the script, "
                     "<script>_prompts.txt)")
    args = ap.parse_args()

    if not os.path.exists(args.script):
        sys.exit(f"Script not found: {args.script}")

    niche = load_niche(args.niche_file)
    script = load_script(args.script)
    style = niche.get("visual_style", {})

    print(f"\n  Visual prompts for: {script.get('title', script.get('hook', ''))}")
    print("  " + "=" * 56)
    if style.get("negative_prompt"):
        print(f"  Negative prompt: {style['negative_prompt']}\n")

    lines = []
    if args.use_claude:
        text = claude_visuals(script, niche, args.tool)
        if text:
            print(text)
            lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        else:
            print("  (falling back to offline prompts)\n")

    prompts_json = []
    if not lines:
        prompts_json = offline_visuals(script, niche, args.tool)
        for p in prompts_json:
            line = f"{p['beat']}. {p['prompt']}"
            lines.append(line)
            print(f"  {line}\n")

    out_path = args.out or os.path.splitext(args.script)[0] + "_prompts.txt"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n\n".join(lines) + "\n")
    print(f"  Saved -> {out_path}")

    if prompts_json:
        json_path = os.path.splitext(out_path)[0] + ".json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(prompts_json, f, indent=2, ensure_ascii=False)
        print(f"  Saved -> {json_path}")

    print(f"\n  Generate each shot in your image/video tool, save as shot_01.png, "
          f"shot_02.png, ... (matching beat order) in one folder, then:\n"
          f"  python tools/assemble_video.py --script {args.script} --images-dir <folder>\n")


if __name__ == "__main__":
    main()
