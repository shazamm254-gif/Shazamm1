#!/usr/bin/env python3
"""
to_verticals.py — feed this repo's scripts into the Verticals v3 render pipeline.

Verticals v3 (github.com/rushindrasinha/youtube-shorts-pipeline, MIT) renders a
Short end to end: b-roll -> voiceover -> captions -> music -> assemble -> upload.
Its own `draft` stage researches a topic and asks an LLM to write the script.

We already have scripts. This adapter replaces that stage: it converts
viral_generator.py output into the draft JSON that `verticals produce` consumes,
so the pipeline starts at the b-roll stage and never rewrites our voiceover.

    generate (ours)                    render (theirs)
    viral_generator.py --json  ->  [ to_verticals.py ]  ->  verticals produce

Usage:
    # 1. Generate scripts and convert them in one pipe
    python tools/viral_generator.py --niche-file tools/niche.json --scripts 5 --json \
        | python tools/to_verticals.py --from-json -

    # 2. Or let the adapter drive the generator directly
    python tools/to_verticals.py --niche-file tools/niche.json --count 5

    # 3. Also write a niche profile so the pipeline uses OUR tone, not its own
    python tools/to_verticals.py --niche-file tools/niche.json --count 5 \
        --niches-dir ../youtube-shorts-pipeline/niches

    # 4. Then render (in the pipeline's repo)
    python -m verticals produce --draft ~/.verticals/drafts/<job_id>.json

Offline viral_generator scripts contain [FACT: ...] research slots. Text-to-speech
reads those aloud verbatim, so this adapter refuses them by default. Either fill
them in, or generate with --use-claude, which writes complete voiceovers.
"""

import argparse
import json
import os
import random
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import viral_generator as vg  # noqa: E402  (BLUEPRINTS + script builders)

DEFAULT_DRAFTS_DIR = os.path.join(os.path.expanduser("~"), ".verticals", "drafts")

# B-roll prompts describe a single still frame, so camera and edit directions
# ("rapid cuts", "cut to black") are noise to an image model. Rewrite the ones
# that carry real framing information; delete the rest.
SHOT_REWRITES = [
    (re.compile(r"pull back to reveal scale/context of", re.I),
     "wide establishing shot showing the scale of"),
    (re.compile(r"cold open on", re.I), ""),
    (re.compile(r"final shot:\s*", re.I), ""),
    (re.compile(r"on-screen text lands with the hook", re.I), ""),
    (re.compile(r"cut to black on the loop line", re.I), ""),
    (re.compile(r"slow push-in|push in", re.I), ""),
    (re.compile(r"motion in the first frame", re.I), "sense of motion"),
    (re.compile(r"\(every 1\.5-3s\)|every 1\.5-3s", re.I), ""),
]
# A shot that is purely a montage instruction can't become one still frame.
MONTAGE = re.compile(r"rapid cuts|one image per", re.IGNORECASE)


def slugify(name):
    """A filename- and profile-safe slug ('Cosmic Dread' -> 'cosmic-dread')."""
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return s or "custom"


def vo_text(script):
    """The full spoken voiceover — every beat joined, in order.

    Offline scripts carry five beats (hook/setup/escalate/payoff/loop); Claude
    scripts carry one. Both normalise to the same `beats` list.
    """
    return " ".join(b.get("text", "").strip() for b in script.get("beats", [])).strip()


def placeholders(text):
    """Unfilled research slots — [FACT: ...], [TIME: ...], [PAYOFF: ...]."""
    return [f"[{kind}: {desc}]" for kind, desc in vg.RESEARCH_RE.findall(text)]


def clean_shot(shot):
    """Rewrite a shot direction so it reads as a still-image prompt."""
    s = shot or ""
    for pattern, replacement in SHOT_REWRITES:
        s = pattern.sub(replacement, s)
    s = re.sub(r"\s{2,}", " ", s)
    s = re.sub(r"\s+([;,.])", r"\1", s)
    return s.strip(" ;,.—–-")


def broll_prompts(script, style_suffix):
    """Exactly 3 image prompts, as the pipeline's b-roll stage expects.

    The pipeline appends the niche profile's prompt_suffix inside its own draft
    stage, which we are bypassing — so we append it here instead.
    """
    topic = (script.get("topic") or "").strip()
    usable = [s for s in script.get("visuals", []) if not MONTAGE.search(s or "")]
    if not usable:
        usable = script.get("visuals", []) or []

    prompts = []
    for shot in usable[:3]:
        cleaned = clean_shot(shot)
        # The shot templates already interpolate the topic; don't say it twice.
        lead = "" if topic and topic.lower() in cleaned.lower() else topic
        parts = [p for p in (lead, cleaned, style_suffix) if p]
        prompts.append(". ".join(parts))

    # Pad rather than emit fewer than 3 — generate_broll indexes into this list.
    while len(prompts) < 3:
        fallback = ["tight framing, high contrast",
                    "wide establishing shot revealing scale",
                    "the payoff image, dramatic lighting"][len(prompts)]
        prompts.append(". ".join(p for p in (topic, fallback, style_suffix) if p))
    return prompts[:3]


def thumbnail_prompt(script, topic, style_suffix):
    """Topic plus its on-screen text, unless that text merely repeats the topic."""
    on_screen = (script.get("on_screen") or "").strip()
    if on_screen.lower().strip(".") == topic.lower().strip("."):
        on_screen = ""
    return ". ".join(p for p in (topic, on_screen, style_suffix) if p)


def style_suffix_for(niche_doc, override=""):
    """The visual signature appended to every b-roll prompt."""
    if override:
        return override
    tone = (niche_doc.get("tone") or "").rstrip(". ")
    base = "vertical 9:16 composition, cinematic lighting, high detail, no text"
    return f"{tone}. {base}" if tone else base


def to_draft(script, niche_doc, niche_slug, style_suffix, platform, job_id):
    """One viral_generator script -> one Verticals draft JSON.

    Key names are fixed by the pipeline: produce reads script/broll_prompts/
    niche, upload reads youtube_title/youtube_description/youtube_tags/news,
    thumbnail reads thumbnail_prompt.
    """
    vo = vo_text(script)
    tags = [h.lstrip("#") for h in script.get("hashtags", [])]
    topic = (script.get("topic") or "").strip()
    desc = script.get("description", "")

    draft = {
        "job_id": job_id,
        "script": vo,
        "broll_prompts": broll_prompts(script, style_suffix),
        "youtube_title": (script.get("title") or topic)[:100],
        "youtube_description": desc,
        "youtube_tags": ",".join(tags),
        "instagram_caption": desc,
        "tiktok_caption": desc,
        "thumbnail_prompt": thumbnail_prompt(script, topic, style_suffix),
        # `news` is the pipeline's topic field; upload.py falls back to it for
        # the video title, so it must always be present.
        "news": topic or script.get("hook", ""),
        "research": (
            f"Script written by tools/viral_generator.py from "
            f"{niche_doc.get('channel_name', niche_slug)}; "
            f"series: {script.get('series', 'n/a')}. "
            f"No live research was run — facts are the script author's."
        ),
        "niche": niche_slug,
        "platform": platform,
    }

    # Mark research + draft done so `produce` resumes at the b-roll stage,
    # exactly as the pipeline's own `draft` command leaves it.
    stamp = time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime())
    draft["_pipeline_state"] = {
        "research": {"status": "done", "timestamp": stamp},
        "draft": {"status": "done", "timestamp": stamp},
    }
    return draft


# ---------------------------------------------------------------------------
# Niche profile emission — so the pipeline speaks in our channel's voice
# ---------------------------------------------------------------------------

def yaml_scalar(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return '"' + str(v).replace("\\", "\\\\").replace('"', '\\"') + '"'


def yaml_dump(obj, indent=0):
    """Minimal YAML writer for the nested dict/list/scalar profile shape.

    Avoids a PyYAML dependency; this repo is stdlib-only by design.
    """
    pad = "  " * indent
    lines = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, (dict, list)) and v:
                lines.append(f"{pad}{k}:")
                lines.append(yaml_dump(v, indent + 1))
            elif isinstance(v, (dict, list)):
                lines.append(f"{pad}{k}: {'{}' if isinstance(v, dict) else '[]'}")
            else:
                lines.append(f"{pad}{k}: {yaml_scalar(v)}")
    elif isinstance(obj, list):
        for item in obj:
            if isinstance(item, dict):
                inner = yaml_dump(item, indent + 1).split("\n")
                first = inner[0].strip()
                lines.append(f"{pad}- {first}")
                lines.extend(inner[1:])
            else:
                lines.append(f"{pad}- {yaml_scalar(item)}")
    return "\n".join(lines)


def niche_profile(niche_doc, slug, style_suffix):
    """Map tools/niche*.json onto the pipeline's niche profile schema."""
    hooks = []
    for i, t in enumerate(niche_doc.get("hook_templates", [])[:6], 1):
        hooks.append({
            "id": f"hook_{i}",
            "template": t,
            "when": "general use",
        })
    tags = [h.lstrip("#") for h in niche_doc.get("core_hashtags", [])]
    return {
        "name": slug,
        "display_name": niche_doc.get("channel_name", slug),
        "description": niche_doc.get("one_line", ""),
        "script": {
            "tone": niche_doc.get("tone", ""),
            "pacing": "fast, front-loaded — a 25-30s Short, not a 60-90s explainer",
            "perspective": niche_doc.get("audience", ""),
            "word_count": "55 to 80",
            "hooks": hooks,
            "cta_variants": [
                f"Follow for more {niche_doc.get('channel_name', 'like this')}.",
                "Which one got you? Comments.",
            ],
            "forbidden_phrases": ["you won't believe", "number 7 will shock you"],
        },
        "visuals": {
            "style": niche_doc.get("tone", "cinematic"),
            "mood": niche_doc.get("tone", ""),
            "prompt_suffix": style_suffix,
        },
        "voice": {
            "pace": "measured, deliberate — let the payoff land",
            "energy": "calm authority",
        },
        "captions": {
            "highlight_color": "#FFD400",
            "text_color": "#FFFFFF",
            "font_size": 72,
            "font_weight": "bold",
            "words_per_group": 3,
        },
        "music": {
            "mood": "ambient tension, no lyrics",
            "energy": "medium",
            "tags": ["ambient", "cinematic"],
        },
        "thumbnail": {
            "style": "one dominant visual, bold text, high contrast",
            "max_words": 5,
        },
        "discovery": {"reddit": {"subreddits": tags[:4] or ["todayilearned"]}},
    }


# ---------------------------------------------------------------------------

def load_scripts(args, rng):
    """Either read viral_generator --json output, or drive it in-process.

    Returns (scripts, niche_doc). The niche doc supplies tone and channel name;
    --from-json only carries it when the niche was generated, not file-loaded.
    """
    niche_doc = read_niche_file(args.niche_file) if args.niche_file else {}

    if args.from_json:
        raw = sys.stdin.read() if args.from_json == "-" else open(args.from_json).read()
        payload = json.loads(raw)
        scripts = payload.get("scripts", [])
        if not scripts:
            sys.exit("No 'scripts' in the JSON payload.")
        # With --niche-file, viral_generator reports the niche as a bare name;
        # only a generated niche comes back as a full dict. Prefer whichever
        # carries the most detail, and fall back to the name for the slug.
        niche = payload.get("niche")
        if isinstance(niche, dict):
            niche_doc = {**niche, **niche_doc}
        elif isinstance(niche, str) and not niche_doc.get("channel_name"):
            niche_doc.setdefault("channel_name", niche)
        return scripts, niche_doc

    return vg.scripts_for_niche_file(rng, niche_doc, args.count), niche_doc


def read_niche_file(ref):
    """Load tools/niche*.json, accepting a bare name, a repo path, or absolute."""
    path = ref if os.path.isabs(ref) else os.path.join(HERE, os.path.basename(ref))
    if not os.path.exists(path):
        sys.exit(f"Niche file not found: {path}")
    with open(path) as f:
        return json.load(f)


def main():
    ap = argparse.ArgumentParser(
        description="Convert viral_generator scripts into Verticals v3 draft JSON.")
    ap.add_argument("--niche-file",
                    help="tools/niche*.json to script and convert. With --from-json "
                         "it only supplies the channel's tone and name.")
    ap.add_argument("--from-json", metavar="PATH",
                    help="Read `viral_generator.py --json` output ('-' for stdin)")
    ap.add_argument("--count", type=int, default=5, help="Scripts to generate (default 5)")
    ap.add_argument("--out-dir", default=DEFAULT_DRAFTS_DIR,
                    help=f"Where to write drafts (default {DEFAULT_DRAFTS_DIR})")
    ap.add_argument("--niches-dir", default="",
                    help="Also write a niche profile YAML into the pipeline's niches/ dir")
    ap.add_argument("--niche-name", default="",
                    help="Profile slug to reference (default: derived from channel name)")
    ap.add_argument("--style-suffix", default="",
                    help="Visual signature appended to every b-roll prompt")
    ap.add_argument("--platform", default="shorts",
                    choices=["shorts", "reels", "tiktok"])
    ap.add_argument("--seed", type=int, default=None, help="Reproducible generation")
    ap.add_argument("--min-words", type=int, default=35,
                    help="Warn below this voiceover word count (default 35)")
    ap.add_argument("--allow-placeholders", action="store_true",
                    help="Convert scripts with unfilled [FACT: ...] slots anyway")
    ap.add_argument("--dry-run", action="store_true", help="Print, don't write")
    args = ap.parse_args()
    if not args.niche_file and not args.from_json:
        ap.error("need --niche-file, --from-json, or both")

    rng = random.Random(args.seed)

    scripts, niche_doc = load_scripts(args, rng)

    slug = args.niche_name or slugify(niche_doc.get("channel_name", "custom"))
    suffix = style_suffix_for(niche_doc, args.style_suffix)

    drafts, skipped = [], []
    ts = int(time.time())
    for i, s in enumerate(scripts, 1):
        vo = vo_text(s)
        slots = placeholders(vo)
        if slots and not args.allow_placeholders:
            skipped.append((s.get("topic", f"#{i}"), slots))
            continue
        words = len(vo.split())
        if words < args.min_words:
            print(f"  ! script {i} ({s.get('topic','')}) is only {words} words — "
                  f"short for a Ken Burns assembly over 3 frames")
        drafts.append(to_draft(s, niche_doc, slug, suffix, args.platform,
                               f"{ts}-{i:02d}"))

    if skipped:
        print(f"\n  Skipped {len(skipped)} script(s) with unfilled research slots.")
        print("  TTS reads these aloud verbatim, so they are not renderable:\n")
        for topic, slots in skipped:
            print(f"    {topic}")
            for slot in slots[:3]:
                print(f"      {slot}")
        print("\n  Fill them in, or regenerate with:")
        print("    python tools/viral_generator.py --niche-file ... --use-claude --json")
        print("  Or pass --allow-placeholders to convert them anyway.\n")

    if not drafts:
        sys.exit("No renderable drafts produced.")

    if args.dry_run:
        print(json.dumps(drafts, indent=2))
        return

    os.makedirs(args.out_dir, exist_ok=True)
    written = []
    for d in drafts:
        path = os.path.join(args.out_dir, f"{d['job_id']}.json")
        with open(path, "w") as f:
            json.dump(d, f, indent=2, ensure_ascii=False)
        written.append(path)

    print(f"\n  Wrote {len(written)} draft(s) to {args.out_dir}")
    for p, d in zip(written, drafts):
        print(f"    {os.path.basename(p)}  {d['youtube_title'][:58]}")

    if args.niches_dir:
        os.makedirs(args.niches_dir, exist_ok=True)
        ypath = os.path.join(args.niches_dir, f"{slug}.yaml")
        with open(ypath, "w") as f:
            f.write(yaml_dump(niche_profile(niche_doc, slug, suffix)) + "\n")
        print(f"\n  Wrote niche profile: {ypath}")

    print("\n  Render with:")
    print(f"    python -m verticals produce --draft {written[0]}")
    if not args.niches_dir:
        print(f"\n  Note: draft references niche '{slug}'. Without --niches-dir the")
        print("  pipeline falls back to its 'general' profile for voice/music/captions.")


if __name__ == "__main__":
    main()
