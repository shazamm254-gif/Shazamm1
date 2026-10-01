#!/usr/bin/env python3
"""
optimize_metadata.py — score and improve a Short's title, description, and tags
against YouTube Shorts best practices, tuned to your niche (from niche.json).

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
# Curiosity-gap openers that work well for fact/awe Shorts.
HOOK_STARTERS = ("what if", "what happens", "this is", "imagine", "scientists",
                 "nobody", "you won't", "the last", "the most", "there's",
                 "something", "how ", "why ", "if ")


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
        issues.append("Doesn't open with a hook. Try 'What if…', 'This is…', "
                      "'The most…', 'Why…', 'How…'.")

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
    # YouTube Help: tags "play a minimal role" in discovery, and excessive tags
    # break the spam policy (support.google.com/youtube/answer/146402). So this
    # only warns about too many, never asks for more.
    if len(tags) > 15:
        issues.append(f"{len(tags)} tags. YouTube says tags play a minimal role and "
                      "excessive tags break its spam policy — keep a few accurate ones.")
    else:
        wins.append(f"{len(tags)} tags — tags barely affect discovery, so this is fine.")
    suggested = [h.lstrip("#") for h in niche["core_hashtags"] + niche["extra_hashtags"]]
    have = {t.lower().lstrip("#") for t in tags}
    missing = [s for s in suggested if s.lower() not in have][:3]
    if missing and not have:
        issues.append("No tags. A few accurate ones are enough: " + ", ".join(missing))
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
    ap.add_argument("--short", type=int,
                    help="Packaging score for Short N from the production doc (Algorithm Killer)")
    ap.add_argument("--image", help="First-frame image to measure (with --short)")
    ap.add_argument("--json", help="Write the packaging result as JSON (with --short)")
    args = ap.parse_args()

    if args.short:
        result = packaging_for_short(args.short, image=args.image)
        print_packaging(result)
        if args.json:
            with open(args.json, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
        return

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


# ===========================================================================
# Packaging scorer — Algorithm Killer, Component 3.
#
# Scores what a viewer sees before deciding to stay: the first frame, the
# on-screen text, the title and the description. Every check names the
# ranking signal it serves (see retention_rules.json "signals") and whether it
# rests on evidence or inference. The existing title/description linters above
# feed in, each mapped to a signal; the ones with no ranking signal are shown
# but not scored.
#
# No click-through estimate: in the Shorts feed the video plays without a
# click, so the first-frame decision is measured as viewed-vs-swiped-away,
# which the retention scorer and the first-frame checks below already target.
# ===========================================================================

import re as _re

ROOT = os.path.dirname(HERE)
CHECKLIST_DOC = os.path.join(ROOT, "docs", "THUMBNAIL_CHECKLIST.md")
DEMAND_CACHE = os.path.join(HERE, "keyword_demand.json")

PACKAGING_WEIGHTS = {  # inference: the frame decides the swipe; the title is read with it
    "first_frame": 0.45, "onscreen_text": 0.15, "title": 0.25, "description": 0.10, "search": 0.05}

# What the existing linters' messages serve. None = no ranking signal: shown, not scored.
EXISTING_SIGNAL = [
    ("chars", "swipe_away", "inference"),           # length / truncation
    ("hook", "swipe_away", "inference"),
    ("power words", "swipe_away", "inference"),
    ("niche keyword", "search", "inference"),
    ("hashtags in the description", "swipe_away", "inference"),
    ("all caps", "swipe_away", "inference"),
    ("context", "search", "inference"),              # description first line
    ("core hashtags", "search", "inference"),
    ("#shorts", None, None),
    ("call to action", None, None),
    ("subscribe", None, None),
]

DARK_LEAD = _re.compile(r"^\W*(the |a |an )?(pure |absolute |total )?(black|blackness|darkness|dark(?! sphere)|"
                        r"void|nothing|emptiness)\b|\b(blinking out|falling into darkness|fades? to black|"
                        r"black screen|pure black filling)\b")
LIGHT_WORDS = r"\b(glow\w*|brilliant|blazing|burning|luminous|bright\w*|crescent|accretion|flare|fire|light|lit|shining|incandescent)\b"
SCALE_WORDS = r"\b(tiny|small|dot|vast|dwarf\w*|filling (most of )?the frame|enormous|colossal|speck|next to earth|scale)\b"
WRONG_WORDS = r"\b(bent|bending|stretch\w*|smeared|warped|no sun|impossible|torn|swallow\w*|frozen|dead)\b"
SMALL_LEAD = _re.compile(r"\b(small|tiny|dot|speck|in one corner|in the corner|far off|distant)\b")
GENERIC_SKY = r"\b(starfield|star field|night sky|field of stars|stars twinkling)\b"
COLLAGE = r"\b(collage|montage|grid of|split screen|several|multiple|many different)\b"
TEXT_IN_IMAGE = r"\b(text|label|labeled|labelled|sign|words|letters|caption|writing|numbers|logo|title|ui|screen)\b"
FACE_IN_IMAGE = r"\b(face|faces|facial|portrait|eyes|man|woman|person|people|child|crowd|astronaut)\b"
STAKES_TEXT = r"(\d|\b(last|end|dead|death|never|forever|no|zero|billions?|trillions?|millions?|minutes|years|light-years|alone|seconds|warning)\b)"
THREAT = r"\b(already (be )?(on (its|their) way|coming|here)|never see it coming|any day now|heading (for|toward) (us|earth))\b"
STOP = set("a an the of in on at to for is are be it this that what if you your and or with from into "
           "its it's than right now really so".split())


def _check(name, ok, detail, fix, signal, basis, points, warn=False):
    return {"name": name, "ok": bool(ok), "detail": detail, "fix": "" if ok else fix,
            "signal": signal, "basis": basis, "points": points, "earned": points if ok else 0,
            "warn": warn}


def checklist_items():
    """The niche's own first-frame checklist, quoted so the page can show its source."""
    try:
        md = open(CHECKLIST_DOC, encoding="utf-8").read()
    except OSError:
        return []
    return [_re.sub(r"\*\*|\*", "", m).strip() for m in _re.findall(r"^- (?:\[ \] )?(.+)$", md, _re.M)]


def score_first_frame(prompt, niche):
    """Shot 1's Flux prompt against docs/THUMBNAIL_CHECKLIST.md, before it is generated."""
    subject = prompt.split(", cinematic")[0]
    low = subject.lower()
    out = [
        _check("Leads with light, not darkness", not DARK_LEAD.search(low),
               f"Prompt opens: \u201c{subject[:70]}\u2026\u201d",
               "Name the light source first and make it the subject. Flux reads 'darkness' "
               "literally and returns a black rectangle — that happened on this pipeline.",
               "swipe_away", "evidence (this repo: docs/IMAGE_PROMPTS_FLUX_COSMIC.md)", 25),
        _check("One glowing focal point", _re.search(LIGHT_WORDS, low),
               "Names a light source" if _re.search(LIGHT_WORDS, low) else "No light source named",
               "Give frame 1 one glowing object (a disk, a crescent, a dying star) against black.",
               "swipe_away", "inference (checklist: one glowing focal point in the void)", 20),
        _check("Focal subject large in frame", not SMALL_LEAD.search(subject.split(",")[0].lower()),
               "The first-named subject is large" if not SMALL_LEAD.search(subject.split(",")[0].lower()) else
               f"The first-named subject is \u201c{SMALL_LEAD.search(subject.split(',')[0].lower()).group(0)}\u201d",
               "Make the subject of frame 1 big and central; put the tiny thing second, for scale.",
               "swipe_away", "inference (checklist quick reject: subject small or off-centre)", 15),
        _check("One subject, not a collage", not _re.search(COLLAGE, low),
               "Single subject" if not _re.search(COLLAGE, low) else
               f"\u201c{_re.search(COLLAGE, low).group(0)}\u201d reads as busy",
               "Cut to one object, large in frame.", "swipe_away",
               "inference (checklist: one clear subject, large in frame)", 15),
        _check("A specific object, not a generic starfield", not _re.search(GENERIC_SKY, low),
               "Specific object" if not _re.search(GENERIC_SKY, low) else "Generic star field",
               "Replace the star field with the specific object this Short is about.", "swipe_away",
               "inference (checklist: avoid generic starfields)", 10),
        _check("Scale shock or wrongness", _re.search(SCALE_WORDS, low) or _re.search(WRONG_WORDS, low),
               ("Has " + ", ".join(sorted({m.group(0) for m in _re.finditer(SCALE_WORDS + "|" + WRONG_WORDS, low)})))
               if (_re.search(SCALE_WORDS, low) or _re.search(WRONG_WORDS, low)) else "Neither scale nor wrongness",
               "Add a scale cue (Earth as a speck beside it) or a wrongness cue (light bending, no sun).",
               "swipe_away", "inference (checklist: scale shock, a 'wrong' visual)", 15),
        _check("No readable text in the image", not _re.search(TEXT_IN_IMAGE, low),
               "No text asked for" if not _re.search(TEXT_IN_IMAGE, low) else
               f"\u201c{_re.search(TEXT_IN_IMAGE, low).group(0)}\u201d invites garbled text",
               "Remove anything that asks Flux to draw words, labels or screens.", "swipe_away",
               "evidence (this repo: Flux rendered fake UI text 'Bole 1')", 10),
        _check("No faces", not _re.search(FACE_IN_IMAGE, low),
               "Faceless" if not _re.search(FACE_IN_IMAGE, low) else
               f"\u201c{_re.search(FACE_IN_IMAGE, low).group(0)}\u201d",
               "Use a silhouette or an object instead.", "swipe_away", "evidence (pipeline limit, CLAUDE.md)", 5),
    ]
    return out


def score_onscreen_text(text, title):
    words = text.split()
    tw = {w for w in _re.findall(r"[a-z']+", title.lower()) if w not in STOP}
    ow = {w for w in _re.findall(r"[a-z']+", text.lower()) if w not in STOP}
    overlap = len(tw & ow) / max(1, len(ow))
    return [
        _check("4 words or fewer", len(words) <= 4, f"{len(words)} words: {text}",
               "Cut to the 3–4 words that carry the number or the stakes.", "swipe_away",
               "inference (checklist: 3–4 words max)", 40),
        _check("A number or stakes word", _re.search(STAKES_TEXT, text.lower()),
               "Has one" if _re.search(STAKES_TEXT, text.lower()) else "No number or stakes word",
               "Use a concrete figure or stakes word: '+100 TRILLION YEARS', '8 MINUTES OF LIGHT'.",
               "swipe_away", "inference (checklist: a number or stakes word lands hard)", 30),
        _check("Adds to the title, doesn't repeat it", overlap < 0.5,
               f"{round(overlap * 100)}% of its words are in the title",
               "Make the on-screen text a second hook, not the title again.", "swipe_away",
               "inference (checklist: don't repeat the title verbatim)", 30),
    ]


def score_title_packaging(title, script, niche):
    issues, wins = lint_title(title, niche)
    out = []
    for msg in wins + issues:
        sig = next(((sg, b) for k, sg, b in EXISTING_SIGNAL if k in msg.lower()), ("swipe_away", "inference"))
        if sig[0] is None:
            continue
        head, _, rest = msg.partition(". ")
        out.append(_check(head.split(" — ")[0].rstrip("."), msg in wins, msg if msg in wins else head + ".",
                          rest or head, sig[0], sig[1], 10))
    # Title must promise what the script delivers: misleading metadata is out of
    # bounds, and a broken promise is a swipe at second 3.
    tw = [w for w in _re.findall(r"[a-z][a-z'-]+", title.lower()) if w not in STOP and len(w) > 3]
    sl = script.lower()
    # Framing words a title may add without promising content.
    framing = {"happens", "terrifying", "unimaginable", "disappeared", "shine", "ever", "gives", "give",
               "makes", "looks", "there", "there's"}
    missing = [w for w in tw if _re.sub(r"'s$", "", w).rstrip("s") not in sl and w not in framing]
    out.append(_check("Title promises what the script delivers", not missing,
                      "Every title word is in the script" if not missing else
                      "Not in the script: " + ", ".join(missing),
                      "Either deliver it in the script or take it out of the title. "
                      "A title the video doesn't keep is misleading metadata.",
                      "swipe_away", "inference + build constraint (no misleading metadata)", 20))
    m = _re.search(THREAT, title.lower())
    out.append(_check("Hard rule 3 in the title", not m, "No invented threat" if not m else m.group(0),
                      "Remove the implied threat.", "policy", "draft hard rule 3", 10))
    kw = next((k for k in sorted(niche["title_keywords"], key=len, reverse=True) if k.lower() in title.lower()), None)
    pos = title.lower().find(kw.lower()) if kw else -1
    out.append(_check("Main keyword in the first 40 characters", kw and pos + len(kw) <= 40,
                      f"\u201c{kw}\u201d ends at character {pos + len(kw)}" if kw else "No niche keyword",
                      "Move the keyword forward; the feed cuts titles off around 40 characters.",
                      "search", "inference (feed truncation, see lint_title)", 10))
    return out, kw


def score_description_packaging(desc, niche, changed_lines=()):
    issues, wins = lint_description(desc, niche)
    out = []
    unscored = []
    for msg in wins + issues:
        sig = next(((sg, b) for k, sg, b in EXISTING_SIGNAL if k in msg.lower()), ("search", "inference"))
        if sig[0] is None:
            unscored.append(msg)
            continue
        head, _, rest = msg.partition(". ")
        out.append(_check(head.split(" — ")[0].rstrip("."), msg in wins, msg if msg in wins else head + ".",
                          rest or head, sig[0], sig[1], 15))
    low = desc.lower()
    stale = [c for c in changed_lines if c and (c.lower() in low or _phrase_overlap(c, low, niche["title_keywords"]))]
    out.append(_check("Doesn't repeat a corrected claim", not stale,
                      "No corrected line repeated" if not stale else
                      "Repeats a claim the rewrite retracted: \u201c" + stale[0][:70] + "\u201d",
                      "Rewrite the description to match the corrected script.",
                      "policy", "hard rule 1 + build constraint (no misleading metadata)", 30))
    m = _re.search(THREAT, low)
    out.append(_check("Hard rule 3 in the description", not m, "No invented threat" if not m else m.group(0),
                      "Remove the implied threat.", "policy", "draft hard rule 3", 10))
    return out, unscored


def _phrase_overlap(a, b, common=()):
    """True if two adjacent distinctive words of a appear in b in order, at most
    one word apart. Catches a description echoing a corrected line ('light
    can't even cross it' vs 'can't cross it'). Niche keywords don't count."""
    common = {w for k in common for w in k.lower().split()}
    def toks(t):
        return _re.findall(r"[a-z0-9']+", t.lower())
    content = lambda w: w not in STOP and w not in common and len(w) > 2
    aw, bw = toks(a), toks(b)
    pos = {}
    for i, w in enumerate(bw):
        pos.setdefault(w, []).append(i)
    for x, y in zip(aw, aw[1:]):
        if content(x) and content(y):
            if any(0 < j - i <= 2 for i in pos.get(x, []) for j in pos.get(y, [])):
                return True
    return False


def search_demand(keyword):
    """Search demand from a cached vidIQ keyword lookup. Claude fills the cache
    (vidiq_keyword_research costs credits); without an entry the check is skipped,
    never guessed."""
    try:
        cache = json.load(open(DEMAND_CACHE, encoding="utf-8"))
    except (OSError, ValueError):
        cache = {}
    hit = cache.get((keyword or "").lower())
    if not hit:
        return {"checked": False, "keyword": keyword,
                "detail": "Not checked: needs a vidIQ keyword lookup (credits reset 15 Oct)."}
    vol = hit.get("volume")
    return {"checked": True, "keyword": keyword, "volume": vol, "competition": hit.get("competition"),
            "as_of": hit.get("as_of"),
            "detail": f"vidIQ volume {vol}/100, competition {hit.get('competition')}/100 ({hit.get('as_of')})"}


def measure_frame(path):
    """Measure a generated first frame (needs Pillow). Catches the black-rectangle
    failure, low contrast, a small subject, and a subject under the Shorts UI."""
    try:
        from PIL import Image, ImageStat
    except ImportError:
        return [{"name": "Frame measurement", "ok": False, "detail": "Pillow not installed",
                 "fix": "pip install pillow", "signal": "swipe_away", "basis": "", "points": 0, "earned": 0}]
    im = Image.open(path).convert("L")
    w, h = im.size
    st = ImageStat.Stat(im)
    hist = im.histogram()
    total = w * h

    def pct(q):
        c = 0
        for i, n in enumerate(hist):
            c += n
            if c >= q * total:
                return i
        return 255
    mean, p5, p95 = st.mean[0], pct(0.05), pct(0.95)
    thresh = max(60, pct(0.90))
    bright = im.point(lambda v: 255 if v >= thresh else 0)
    bbox = bright.getbbox()
    area = sum(1 for v in bright.getdata() if v) / total
    cx = cy = None
    if bbox:
        xs = ys = n = 0
        small = bright.resize((max(1, w // 8), max(1, h // 8)))
        sw, sh = small.size
        for i, v in enumerate(small.getdata()):
            if v > 127:
                xs += i % sw; ys += i // sw; n += 1
        if n:
            cx, cy = xs / n / sw, ys / n / sh
    thumb = im.resize((32, 57))
    tst = ImageStat.Stat(thumb)
    out = [
        _check("Not a black frame", mean > 12 and p95 > 80, f"Mean brightness {mean:.0f}/255, 95th percentile {p95}",
               "Regenerate: lead the prompt with the light source.", "swipe_away",
               "evidence (this repo: Flux returned a black rectangle)", 30),
        _check("High contrast", p95 - p5 >= 120, f"Contrast span {p95 - p5}/255",
               "Brighten the focal object or deepen the background.", "swipe_away", "inference (checklist)", 20),
        _check("Subject big enough", 0.02 <= area <= 0.45, f"Bright subject covers {area * 100:.1f}% of the frame",
               "Push in until the subject fills more of the frame." if area < 0.02 else
               "Too much of the frame is bright: give the subject black space around it.",
               "swipe_away", "inference (checklist: one subject, large in frame)", 20),
        _check("Clear of the Shorts UI", cx is not None and cy < 0.75 and cx < 0.82,
               f"Subject centre at {cx * 100:.0f}% across, {cy * 100:.0f}% down" if cx is not None else "No subject found",
               "Recompose so the subject sits above the bottom quarter and away from the right edge.",
               "swipe_away", "inference (checklist: UI covers the bottom and right)", 15),
        _check("Reads at fingernail size", tst.stddev[0] >= 30, f"Contrast at 32px wide: {tst.stddev[0]:.0f}",
               "Simplify: one bright shape on black survives shrinking.", "swipe_away",
               "inference (checklist: shrink to fingernail size)", 15),
    ]
    return out


def _section(checks):
    total = sum(c["points"] for c in checks) or 1
    return round(100 * sum(c["earned"] for c in checks) / total)


def packaging_for_short(num, image=None, doc=None):
    """Packaging score for a Short in the production doc, using any checked rewrite."""
    import glob
    sys.path.insert(0, HERE)
    import retention_score as rs
    niche = load_niche()
    doc = doc or rs.DEFAULT_DOC
    s = next((x for x in rs.load_doc_shorts(doc) if x["num"] == num), None)
    if not s:
        raise SystemExit(f"No Short #{num} in the doc.")
    md = open(doc, encoding="utf-8").read()
    sec = _re.search(rf"^## {num} — .*?(?=^## |\Z)", md, _re.S | _re.M).group(0)
    field = lambda k: (_re.search(rf"\*\*{k}:\*\*\s*`?(.+?)`?\s*$", sec, _re.M) or [None, ""])[1].strip()
    title, desc, onscreen = field("Title"), field("Description"), field("On-screen")
    shot1 = (_re.search(r"\*\*Shot 1\*\*\n```\n(.*?)\n```", sec, _re.S) or [None, ""])[1]
    script = s["voiceover"] + " " + s["end_line"]

    # A checked rewrite changes the script, may replace shot 1, and may fix the description.
    prop = None
    for path in glob.glob(os.path.join(HERE, "rewrites", "*.json")):
        p = json.load(open(path, encoding="utf-8"))
        if p.get("short") == num:
            prop = p
    changed = []
    original = {"title": title, "description": desc, "onscreen": onscreen, "shot1": shot1}
    if prop:
        by = {r["beat"]: r for r in prop.get("rewrites", [])}
        beats = rs.doc_beats(s)
        # Phrases a rewrite retracted as false; metadata must not repeat them.
        changed = [p for r in by.values() for p in r.get("retracts", [])]
        script = " ".join(by[i + 1]["after"] if i + 1 in by else b for i, b in enumerate(beats))
        for sh in prop.get("shots", []):
            if sh.get("replaces") == "Shot 1":
                shot1 = sh["prompt"]
        pk = prop.get("packaging", {})
        desc = pk.get("description", desc)
        title = pk.get("title", title)
        onscreen = pk.get("onscreen", onscreen)
    result = _package(num, s, niche, title, desc, onscreen, shot1, script, changed, image)
    changed_fields = {k: v for k, v in original.items()
                      if v != {"title": title, "description": desc, "onscreen": onscreen, "shot1": shot1}[k]}
    if changed_fields:
        before = _package(num, s, niche, original["title"], original["description"], original["onscreen"],
                          original["shot1"], script, changed, None)
        result["before"] = {"overall": before["overall"], "sections": before["sections"],
                            "fields": changed_fields,
                            "failed": [c["name"] for cs in before["checks"].values() for c in cs if not c["ok"]]}
    return result


def _package(num, s, niche, title, desc, onscreen, shot1, script, changed, image):
    ff = score_first_frame(shot1, niche)
    if image:
        ff += measure_frame(image)
    ot = score_onscreen_text(onscreen, title)
    tt, kw = score_title_packaging(title, script, niche)
    dd, unscored = score_description_packaging(desc, niche, changed)
    sd = search_demand(kw)
    sections = {"first_frame": _section(ff), "onscreen_text": _section(ot),
                "title": _section(tt), "description": _section(dd)}
    weights = dict(PACKAGING_WEIGHTS)
    if sd["checked"]:
        sections["search"] = min(100, sd["volume"] or 0)
    else:
        weights.pop("search")
    wsum = sum(weights.values())
    overall = round(sum(sections[k] * w for k, w in weights.items()) / wsum)
    return {"num": num, "label": f"#{num} {s['title']}", "overall": overall, "sections": sections,
            "weights": {k: round(w / wsum, 2) for k, w in weights.items()},
            "title": title, "description": desc,
            "onscreen": onscreen, "shot1": shot1, "image_measured": bool(image),
            "checks": {"first_frame": ff, "onscreen_text": ot, "title": tt, "description": dd},
            "search": sd, "unscored": unscored, "checklist_source": "docs/THUMBNAIL_CHECKLIST.md",
            "checklist_items": len(checklist_items())}


def print_packaging(r):
    print(f"\n  Packaging {r['overall']}/100 — {r['label']}")
    for k, v in r["sections"].items():
        print(f"    {k:<14} {v:>3}")
    for k, checks in r["checks"].items():
        for c in checks:
            if not c["ok"]:
                print(f"    ✗ [{k}] {c['name']}: {c['detail']} → {c['fix']}")
    print(f"    search: {r['search']['detail']}\n")


if __name__ == "__main__":
    main()
